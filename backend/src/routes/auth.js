import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createPasswordService } from '../services/passwordService.js';
import { createAuthService } from '../services/authService.js';
import { createGoogleAuthService } from '../services/googleAuthService.js';
import { createGoogleOAuthClient } from '../services/googleOAuthClient.js';
import { createOAuthStateService } from '../services/oauthStateService.js';
import { createAuthController } from '../controllers/authController.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerBodySchema,
  loginBodySchema,
  oauthCompleteBodySchema,
  oauthRegisterBodySchema,
} from '../validation/auth.schemas.js';

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createAuthRouter({ env }) {
  const router = Router();

  router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    next();
  });

  const passwordService = createPasswordService({ bcryptCost: env.BCRYPT_COST });
  const tokenService = createTokenService(env);
  const authService = createAuthService({ env, passwordService, tokenService });
  const googleAuthService = createGoogleAuthService();
  const googleOAuthClient = createGoogleOAuthClient(env);
  const oauthStateService = createOAuthStateService(env);
  const authController = createAuthController({
    authService,
    env,
    tokenService,
    googleAuthService,
    googleOAuthClient,
    oauthStateService,
  });
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

  const refreshLimiter = rateLimit({
    windowMs: env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_REFRESH_RATE_LIMIT_MAX,
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
  router.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
  router.post('/logout', asyncHandler(authController.logout));
  router.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));
  router.get('/me', requireAuth, asyncHandler(authController.me));
  router.get('/socket-handshake', requireAuth, asyncHandler(authController.socketHandshake));
  router.get('/socket-admission', requireAuth, asyncHandler(authController.socketAdmission));

  router.get('/google', authLimiter, asyncHandler(authController.googleStart));
  router.get('/google/callback', authLimiter, asyncHandler(authController.googleCallback));
  router.post(
    '/oauth/complete',
    authLimiter,
    validateBody(oauthCompleteBodySchema),
    asyncHandler(authController.oauthComplete),
  );
  router.get('/oauth/signup-preview', authLimiter, asyncHandler(authController.oauthSignupPreview));
  router.get('/username-available', authLimiter, asyncHandler(authController.usernameAvailable));
  router.post(
    '/oauth/register',
    authLimiter,
    validateBody(oauthRegisterBodySchema),
    asyncHandler(authController.oauthRegister),
  );

  return router;
}
