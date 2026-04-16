import { ACCESS_TOKEN_COOKIE } from '../constants/auth.js';
import { AppError } from '../errors/AppError.js';
import { userRepository } from '../repositories/userRepository.js';

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
 * @param {{
 *   tokenService: ReturnType<import('../services/tokenService.js').createTokenService>,
 * }} params
 */
export function createAuthMiddleware({ tokenService }) {
  /**
   * Verifies access JWT, loads user, attaches `req.user`. Fails with 401 if missing or invalid.
   * @type {import('express').RequestHandler}
   */
  async function requireAuth(req, res, next) {
    try {
      const token = readAccessToken(req);
      if (!token) {
        throw new AppError(401, 'Authentication required', { code: 'UNAUTHENTICATED', expose: true });
      }
      const { sub, sid } = await tokenService.verifyAccessToken(token);
      const user = await userRepository.findByIdLean(sub);
      if (!user?.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS', expose: true });
      }
      req.user = {
        id: String(user._id),
        username: user.username,
        roles: user.roles,
        sid,
      };
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
