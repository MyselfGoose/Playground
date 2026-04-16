import { ACCESS_TOKEN_COOKIE } from '../constants/auth.js';
import { AppError } from '../errors/AppError.js';
import { userRepository } from '../repositories/userRepository.js';
import { refreshSessionRepository } from '../repositories/refreshSessionRepository.js';

/**
 * @param {import('express').Request} req
 */
export function readAccessToken(req) {
  const auth = req.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return req.cookies?.[ACCESS_TOKEN_COOKIE];
}

/**
 * Verify an access JWT and resolve the authenticated user. Used by both HTTP `requireAuth`
 * and the socket handshake so both layers apply the same policy (JWT valid + user active +
 * refresh session still live).
 *
 * @param {string} token
 * @param {{ tokenService: ReturnType<import('../services/tokenService.js').createTokenService> }} deps
 */
export async function resolveAccessContext(token, { tokenService }) {
  const { sub, sid } = await tokenService.verifyAccessToken(token);
  const user = await userRepository.findByIdLean(sub);
  if (!user?.isActive) {
    throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
  }
  const sessionAlive = await refreshSessionRepository.isJtiActive(sid);
  if (!sessionAlive) {
    throw new AppError(401, 'Session revoked', { code: 'SESSION_REVOKED', expose: true });
  }
  return {
    id: String(user._id),
    username: user.username,
    roles: user.roles,
    sid,
  };
}

/**
 * @param {{
 *   tokenService: ReturnType<import('../services/tokenService.js').createTokenService>,
 * }} params
 */
export function createAuthMiddleware({ tokenService }) {
  /**
   * Verifies access JWT, checks session liveness, loads user, attaches `req.user`. Fails with 401.
   * @type {import('express').RequestHandler}
   */
  async function requireAuth(req, res, next) {
    try {
      const token = readAccessToken(req);
      if (!token) {
        throw new AppError(401, 'Authentication required', { code: 'UNAUTHENTICATED', expose: true });
      }
      req.user = await resolveAccessContext(token, { tokenService });
      next();
    } catch (err) {
      next(err);
    }
  }

  /**
   * After `requireAuth`, ensures the user has at least one allowed role.
   * @param {...string} allowedRoles
   */
  function optionalRoleGuard(...allowedRoles) {
    /** @type {import('express').RequestHandler} */
    return (req, res, next) => {
      if (!req.user) {
        return next(
          new AppError(401, 'Authentication required', { code: 'UNAUTHENTICATED', expose: true }),
        );
      }
      const ok = allowedRoles.some((r) => req.user.roles.includes(r));
      if (!ok) {
        return next(new AppError(403, 'Forbidden', { code: 'FORBIDDEN', expose: true }));
      }
      next();
    };
  }

  return { requireAuth, optionalRoleGuard, authenticate: requireAuth };
}
