import { AppError } from '../errors/AppError.js';
import { newJti } from '../utils/crypto.js';
import { parseDurationToMs } from '../utils/parseDuration.js';
import { userRepository } from '../repositories/userRepository.js';
import { refreshSessionRepository } from '../repositories/refreshSessionRepository.js';

/**
 * @param {{
 *   env: import('../config/env.js').Env,
 *   passwordService: ReturnType<import('./passwordService.js').createPasswordService>,
 *   tokenService: ReturnType<import('./tokenService.js').createTokenService>,
 * }} params
 */
export function createAuthService({ env, passwordService, tokenService }) {
  const refreshTtlMs = () => parseDurationToMs(env.JWT_REFRESH_EXPIRY);

  /**
   * @param {{ _id: unknown, roles: string[] }} userDoc
   * @param {{ userAgent?: string, ip?: string }} meta
   */
  async function issueSessionAndTokens(userDoc, meta) {
    const userId = String(userDoc._id);
    const roles = userDoc.roles;
    const jti = newJti();
    const expiresAt = new Date(Date.now() + refreshTtlMs());
    await refreshSessionRepository.createSession({
      userId: userDoc._id,
      jti,
      expiresAt,
      userAgent: meta.userAgent,
      createdFromIp: meta.ip,
    });
    const refreshToken = await tokenService.signRefreshToken(userId, jti);
    const accessToken = await tokenService.signAccessToken(userId, roles, jti);
    const user = await userRepository.findByIdLean(userId);
    if (!user) {
      throw new AppError(500, 'Session creation failed', { code: 'AUTH_ERROR', expose: false });
    }
    return { user, accessToken, refreshToken };
  }

  return {
    /**
     * @param {{ username: string, email: string, password: string }} input
     * @param {{ userAgent?: string, ip?: string }} meta
     */
    async register(input, meta) {
      const { username, email, password } = input;
      const [byU, byE] = await Promise.all([
        userRepository.findByUsername(username),
        userRepository.findByEmail(email),
      ]);
      if (byU) {
        throw new AppError(409, 'Username already taken', { code: 'USERNAME_TAKEN', expose: true });
      }
      if (byE) {
        throw new AppError(409, 'Email already registered', { code: 'EMAIL_TAKEN', expose: true });
      }
      const passwordHash = await passwordService.hash(password);
      const created = await userRepository.createUser({
        username,
        email: email.toLowerCase(),
        passwordHash,
        roles: ['user'],
      });
      return issueSessionAndTokens(
        { _id: created._id, roles: /** @type {string[]} */ (created.roles) },
        meta,
      );
    },

    /**
     * @param {{ email?: string, username?: string, password: string }} input
     * @param {{ userAgent?: string, ip?: string }} meta
     */
    async login(input, meta) {
      const { email, username, password } = input;
      let user = null;
      if (email) {
        user = await userRepository.findByEmailWithPassword(email);
      } else if (username) {
        user = await userRepository.findByUsernameWithPassword(username);
      }
      if (!user?.passwordHash) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
      }
      if (!user.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
      }
      const ok = await passwordService.verify(password, user.passwordHash);
      if (!ok) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
      }
      await userRepository.updateLastLogin(user._id);
      return issueSessionAndTokens({ _id: user._id, roles: user.roles }, meta);
    },

    /**
     * @param {string} refreshToken
     * @param {{ userAgent?: string, ip?: string }} meta
     */
    async refresh(refreshToken, meta) {
      const { sub, jti } = await tokenService.verifyRefreshToken(refreshToken);
      const session = await refreshSessionRepository.findByJti(jti);
      if (!session) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
      }
      if (session.revokedAt || session.replacedByJti) {
        await refreshSessionRepository.revokeAllForUser(session.userId);
        throw new AppError(401, 'Invalid credentials', { code: 'TOKEN_REUSE', expose: true });
      }
      if (session.expiresAt <= new Date()) {
        throw new AppError(401, 'Invalid credentials', { code: 'SESSION_EXPIRED', expose: true });
      }
      if (String(session.userId) !== sub) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
      }

      const newSessionJti = newJti();
      const expiresAt = new Date(Date.now() + refreshTtlMs());
      await refreshSessionRepository.createSession({
        userId: session.userId,
        jti: newSessionJti,
        expiresAt,
        userAgent: meta.userAgent,
        createdFromIp: meta.ip,
      });
      await refreshSessionRepository.markSessionRotated(jti, newSessionJti);

      const user = await userRepository.findByIdLean(sub);
      if (!user?.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
      }
      const refreshOut = await tokenService.signRefreshToken(sub, newSessionJti);
      const accessOut = await tokenService.signAccessToken(sub, user.roles, newSessionJti);
      return { user, accessToken: accessOut, refreshToken: refreshOut };
    },

    /**
     * @param {string} accessToken
     */
    async logout(accessToken) {
      const { sid } = await tokenService.verifyAccessToken(accessToken);
      await refreshSessionRepository.revokeByJti(sid);
    },

    /**
     * Revoke refresh session when no valid access token is available (e.g. access expired).
     * @param {string} refreshToken
     */
    async logoutByRefresh(refreshToken) {
      let jti;
      try {
        ({ jti } = await tokenService.verifyRefreshToken(refreshToken));
      } catch {
        return;
      }
      await refreshSessionRepository.revokeByJti(jti);
    },

    /**
     * @param {string} accessToken
     */
    async logoutAll(accessToken) {
      const { sub } = await tokenService.verifyAccessToken(accessToken);
      await refreshSessionRepository.revokeAllForUser(sub);
    },

    /**
     * @param {string} userId
     */
    async me(userId) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      if (!user.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'USER_INACTIVE', expose: true });
      }
      return user;
    },
  };
}
