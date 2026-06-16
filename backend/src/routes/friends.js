import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';
import { friendsService } from '../services/friendsService.js';
import { getSocialHub } from '../realtime/socialHub.js';
import { sendFriendRequestBodySchema } from '../validation/friends.schemas.js';
import { requireMongoReady } from './requireMongoReady.js';

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createFriendsRouter({ env }) {
  const router = Router();
  router.use(requireMongoReady);

  const tokenService = createTokenService(env);
  const { requireAuth } = createAuthMiddleware({ tokenService });

  const sendRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    message: { error: { message: 'Too many friend requests', code: 'RATE_LIMITED' } },
  });

  const lookupLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    message: { error: { message: 'Too many lookups', code: 'RATE_LIMITED' } },
  });

  router.get(
    '/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      const hub = getSocialHub();
      const summary = await friendsService.getSummary(req.user.id, hub?.presence ?? null);
      res.json({ data: summary });
    }),
  );

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const hub = getSocialHub();
      const summary = await friendsService.getSummary(req.user.id, hub?.presence ?? null);
      res.json({ data: { friends: summary.friends } });
    }),
  );

  router.get(
    '/lookup/:username',
    requireAuth,
    lookupLimiter,
    asyncHandler(async (req, res) => {
      const username = String(req.params.username ?? '').trim();
      if (!username) {
        throw new AppError(400, 'Username required', { code: 'VALIDATION_ERROR', expose: true });
      }
      const data = await friendsService.lookupUsername(req.user.id, username);
      res.json({ data });
    }),
  );

  router.post(
    '/requests',
    requireAuth,
    sendRequestLimiter,
    validateBody(sendFriendRequestBodySchema),
    asyncHandler(async (req, res) => {
      const result = await friendsService.sendRequest(req.user.id, req.body.username);
      res.status(result.autoAccepted ? 200 : 201).json({ data: result });
    }),
  );

  router.post(
    '/requests/:requestId/accept',
    requireAuth,
    asyncHandler(async (req, res) => {
      const friendship = await friendsService.acceptRequest(req.user.id, req.params.requestId);
      res.json({ data: { friendship } });
    }),
  );

  router.post(
    '/requests/:requestId/decline',
    requireAuth,
    asyncHandler(async (req, res) => {
      const friendship = await friendsService.declineRequest(req.user.id, req.params.requestId);
      res.json({ data: { friendship } });
    }),
  );

  router.delete(
    '/requests/:requestId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const friendship = await friendsService.cancelRequest(req.user.id, req.params.requestId);
      res.json({ data: { friendship } });
    }),
  );

  router.delete(
    '/:userId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await friendsService.unfriend(req.user.id, req.params.userId);
      res.json({ data });
    }),
  );

  return router;
}
