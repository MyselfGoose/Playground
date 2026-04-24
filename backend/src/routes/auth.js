import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createPasswordService } from '../services/passwordService.js';
import { createAuthService } from '../services/authService.js';
import { createAuthController } from '../controllers/authController.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerBodySchema, loginBodySchema } from '../validation/auth.schemas.js';

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createAuthRouter({ env }) {
  const router = Router();

  // Preflight must never hit body validation or auth — CORS at app level should answer first; this is defensive.
  router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    next();
  });

  const passwordService = createPasswordService({ bcryptCost: env.BCRYPT_COST });
  const tokenService = createTokenService(env);
  const authService = createAuthService({ env, passwordService, tokenService });
  const authController = createAuthController({ authService, env });
  const { requireAuth } = createAuthMiddleware({ tokenService });

  const authLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  });

  router.post(
    '/register',
    authLimiter,
    validateBody(registerBodySchema),
    asyncHandler(authController.register),
  );
  router.post('/login', authLimiter, validateBody(loginBodySchema), asyncHandler(authController.login));
  router.post('/refresh', authLimiter, asyncHandler(authController.refresh));
  router.post('/logout', asyncHandler(authController.logout));
  router.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));
  router.get('/me', requireAuth, asyncHandler(authController.me));
  router.get('/socket-handshake', requireAuth, asyncHandler(authController.socketHandshake));

  return router;
}
