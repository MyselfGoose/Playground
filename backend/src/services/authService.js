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

  /** Mongo duplicate-key errors are thrown with `code === 11000`. */
  function isDuplicateKeyError(err) {
    return Boolean(err && typeof err === 'object' && /** @type {any} */ (err).code === 11000);
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
      let created;
      try {
        created = await userRepository.createUser({
          username,
          email,
          passwordHash,
          roles: ['user'],
        });
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          const field = /** @type {any} */ (err)?.keyPattern?.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN';
          throw new AppError(409, 'Username or email already taken', {
            code: field,
            expose: true,
          });
        }
        throw err;
      }
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
     * Atomically rotate the refresh session. Exactly one concurrent caller with the same refresh
     * token wins; the others fail. Reuse of an already-rotated/revoked token revokes all sessions.
     *
     * @param {string} refreshToken
     * @param {{ userAgent?: string, ip?: string }} meta
     */
    async refresh(refreshToken, meta) {
      const { sub, jti } = await tokenService.verifyRefreshToken(refreshToken);

      const newSessionJti = newJti();
      const rotated = await refreshSessionRepository.atomicRotate(jti, newSessionJti);

      if (!rotated) {
        // Either the session never existed, is expired, is already revoked, or was already
        // rotated by a concurrent refresh. Disambiguate by loading the row directly.
        const stale = await refreshSessionRepository.findByJti(jti);
        if (!stale) {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
        }
        if (stale.replacedByJti || stale.revokedAt) {
          // Token reuse: someone is presenting a refresh token that has already been rotated or
          // revoked. Nuke every session for this user.
          await refreshSessionRepository.revokeAllForUser(stale.userId);
          throw new AppError(401, 'Invalid credentials', { code: 'TOKEN_REUSE', expose: true });
        }
        throw new AppError(401, 'Invalid credentials', { code: 'SESSION_EXPIRED', expose: true });
      }

      if (String(rotated.userId) !== sub) {
        // JWT `sub` mismatch with stored session — treat as tamper.
        await refreshSessionRepository.revokeAllForUser(rotated.userId);
        throw new AppError(401, 'Invalid credentials', { code: 'TOKEN_REUSE', expose: true });
      }

      const expiresAt = new Date(Date.now() + refreshTtlMs());
      await refreshSessionRepository.createSession({
        userId: rotated.userId,
        jti: newSessionJti,
        expiresAt,
        userAgent: meta.userAgent,
        createdFromIp: meta.ip,
      });

      const user = await userRepository.findByIdLean(sub);
      if (!user?.isActive) {
        // User was deactivated between refreshes. Keep rotation state tidy.
        await refreshSessionRepository.revokeByJti(newSessionJti);
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
