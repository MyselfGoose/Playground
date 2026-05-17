import * as jose from 'jose';
import { AppError } from '../errors/AppError.js';
import { safeNextPath } from '../utils/safeNextPath.js';
import { newJti } from '../utils/crypto.js';

/**
 * @param {import('../config/env.js').Env} env
 */
export function createOAuthStateService(env) {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

  return {
    /**
     * @param {string} nextPath
     */
    async signOAuthState(nextPath) {
      const next = safeNextPath(nextPath);
      return new jose.SignJWT({ typ: 'oauth_state', next, nonce: newJti() })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(secret);
    },

    /**
     * @param {string} state
     */
    async verifyOAuthState(state) {
      try {
        const { payload } = await jose.jwtVerify(state, secret, { algorithms: ['HS256'] });
        if (payload.typ !== 'oauth_state' || typeof payload.next !== 'string') {
          throw new AppError(400, 'Invalid OAuth state', { code: 'OAUTH_STATE_INVALID', expose: true });
        }
        return { next: safeNextPath(payload.next) };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(400, 'Invalid OAuth state', { code: 'OAUTH_STATE_INVALID', expose: true });
      }
    },
  };
}
