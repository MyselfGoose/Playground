import { AppError } from '../errors/AppError.js';
import { getMaintenanceCached } from '../services/platformSettingsService.js';
import { readAccessToken, resolveAccessContext } from './authMiddleware.js';

const EXEMPT_PREFIXES = ['/health', '/api/v1/auth', '/api/v1/admin'];

/**
 * @param {{ tokenService: ReturnType<import('../services/tokenService.js').createTokenService> }} params
 */
export function createMaintenanceMiddleware({ tokenService }) {
  /** @type {import('express').RequestHandler} */
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const path = req.path;
    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return next();
    }

    const maintenance = getMaintenanceCached();
    if (!maintenance.maintenanceMode) {
      return next();
    }

    const token = readAccessToken(req);
    if (token) {
      try {
        const user = await resolveAccessContext(token, { tokenService });
        if (user.roles?.includes('admin')) {
          return next();
        }
      } catch {
        // fall through to maintenance response
      }
    }

    return next(
      new AppError(503, maintenance.maintenanceMessage || 'Platform is under maintenance', {
        code: 'MAINTENANCE_MODE',
        expose: true,
      }),
    );
  };
}
