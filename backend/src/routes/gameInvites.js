import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { gameInviteService } from '../services/gameInviteService.js';
import {
  gameInviteIdParamSchema,
  markGameInvitesReadBodySchema,
  sendGameInviteBodySchema,
} from '../validation/gameInvites.schemas.js';
import { requireMongoReady } from './requireMongoReady.js';

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createGameInvitesRouter({ env }) {
  const router = Router();
  router.use(requireMongoReady);

  const tokenService = createTokenService(env);
  const { requireAuth } = createAuthMiddleware({ tokenService });

  const sendInviteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    message: { error: { message: 'Too many game invites', code: 'RATE_LIMITED' } },
  });

  router.get(
    '/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      const summary = await gameInviteService.getSummary(req.user.id);
      res.json({ data: summary });
    }),
  );

  router.post(
    '/',
    requireAuth,
    sendInviteLimiter,
    validateBody(sendGameInviteBodySchema),
    asyncHandler(async (req, res) => {
      const result = await gameInviteService.sendInvite(req.user.id, req.body);
      res.status(201).json({ data: result });
    }),
  );

  router.post(
    '/mark-read',
    requireAuth,
    validateBody(markGameInvitesReadBodySchema),
    asyncHandler(async (req, res) => {
      const result = await gameInviteService.markRead(req.user.id, req.body.inviteIds);
      res.json({ data: result });
    }),
  );

  router.post(
    '/:inviteId/accept',
    requireAuth,
    asyncHandler(async (req, res) => {
      gameInviteIdParamSchema.parse({ inviteId: req.params.inviteId });
      const result = await gameInviteService.acceptInvite(req.user.id, req.params.inviteId);
      res.json({ data: result });
    }),
  );

  router.post(
    '/:inviteId/decline',
    requireAuth,
    asyncHandler(async (req, res) => {
      gameInviteIdParamSchema.parse({ inviteId: req.params.inviteId });
      const result = await gameInviteService.declineInvite(req.user.id, req.params.inviteId);
      res.json({ data: result });
    }),
  );

  router.delete(
    '/:inviteId',
    requireAuth,
    asyncHandler(async (req, res) => {
      gameInviteIdParamSchema.parse({ inviteId: req.params.inviteId });
      const result = await gameInviteService.cancelInvite(req.user.id, req.params.inviteId);
      res.json({ data: result });
    }),
  );

  return router;
}
