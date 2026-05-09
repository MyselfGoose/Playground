import * as jose from 'jose';
import { AppError } from '../errors/AppError.js';

/**
 * @param {import('../config/env.js').Env} env
 */
export function createTokenService(env) {
  const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

  return {
    /**
     * @param {string} userId
     * @param {string[]} roles
     * @param {string} sid refresh session jti
     */
    async signAccessToken(userId, roles, sid) {
      return new jose.SignJWT({ typ: 'access', roles, sid })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(env.JWT_ACCESS_EXPIRY)
        .sign(accessSecret);
    },

    /**
     * @param {string} userId
     * @param {string} jti
     */
    async signRefreshToken(userId, jti) {
      return new jose.SignJWT({ typ: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(env.JWT_REFRESH_EXPIRY)
        .sign(refreshSecret);
    },

    /**
     * @param {string} token
     */
    async verifyAccessToken(token) {
      try {
        const { payload } = await jose.jwtVerify(token, accessSecret, {
          algorithms: ['HS256'],
        });
        if (payload.typ !== 'access' || typeof payload.sid !== 'string') {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
        }
        if (!Array.isArray(payload.roles)) {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
        }
        return {
          sub: String(payload.sub),
          roles: /** @type {string[]} */ (payload.roles),
          sid: payload.sid,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
      }
    },

    /**
     * @param {string} token
     */
    async verifyRefreshToken(token) {
      try {
        const { payload } = await jose.jwtVerify(token, refreshSecret, {
          algorithms: ['HS256'],
        });
        if (payload.typ !== 'refresh' || typeof payload.jti !== 'string') {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
        }
        return {
          sub: String(payload.sub),
          jti: payload.jti,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
      }
    },

    /**
     * Disposable realtime handshake credential bound to refresh session `sid` (not a second identity root).
     * Signed with access secret so verification stays local to API tier.
     * @param {string} userId
     * @param {string[]} roles
     * @param {string} sid refresh session jti
     */
    async signSocketAdmissionToken(userId, roles, sid) {
      return new jose.SignJWT({ typ: 'socket_admission', roles, sid })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(env.JWT_SOCKET_ADMISSION_EXPIRY)
        .sign(accessSecret);
    },

    /**
     * @param {string} token
     */
    async verifySocketAdmissionToken(token) {
      try {
        const { payload } = await jose.jwtVerify(token, accessSecret, {
          algorithms: ['HS256'],
        });
        if (payload.typ !== 'socket_admission' || typeof payload.sid !== 'string') {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
        }
        if (!Array.isArray(payload.roles)) {
          throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
        }
        return {
          sub: String(payload.sub),
          roles: /** @type {string[]} */ (payload.roles),
          sid: payload.sid,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_TOKEN', expose: true });
      }
    },
  };
}
