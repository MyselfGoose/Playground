import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireMongoReady } from './requireMongoReady.js';
import { createAdminDashboardService, clearDashboardCache } from '../services/admin/adminDashboardService.js';
import { createAdminUserService } from '../services/admin/adminUserService.js';
import { createAdminFeedbackService } from '../services/admin/adminFeedbackService.js';
import { adminAuthSecurityService } from '../services/admin/adminAuthSecurityService.js';
import { createAdminLiveOpsService } from '../services/admin/adminLiveOpsService.js';
import { adminAuditService } from '../services/admin/adminAuditService.js';
import { setMaintenanceMode } from '../services/platformSettingsService.js';
import { runLeaderboardDailyCron } from '../jobs/leaderboardCron.js';
import { userRepository } from '../repositories/userRepository.js';
import { FibbagePrompt } from '../models/FibbagePrompt.js';
import {
  adminUserSearchQuerySchema,
  adminUserPatchBodySchema,
  adminStatsPatchBodySchema,
  adminMaintenancePatchBodySchema,
  adminMatchHistoryQuerySchema,
  adminFeedbackQuerySchema,
  adminRoomsQuerySchema,
  adminRoomKickBodySchema,
  adminOAuthPatchBodySchema,
  adminGamesPatchBodySchema,
  adminRoomCreationPatchBodySchema,
  adminAbuseQuerySchema,
  adminNpatListQuerySchema,
} from '../validation/admin.schemas.js';

/**
 * @param {{ env: import('../config/env.js').Env, logger?: import('pino').Logger }} params
 */
export function createAdminRouter({ env, logger }) {
  const router = Router();
  router.use(requireMongoReady);

  const tokenService = createTokenService(env);
  const { requireAuth, optionalRoleGuard, requireAdminFromDb } = createAuthMiddleware({ tokenService });
  const requireAdmin = [requireAuth, optionalRoleGuard('admin')];
  const requireAdminMutation = [requireAuth, optionalRoleGuard('admin'), requireAdminFromDb];

  const adminLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  });
  router.use(adminLimiter);

  const dashboardService = createAdminDashboardService(env);
  const userService = createAdminUserService(env);
  const feedbackService = createAdminFeedbackService(env);
  const liveOpsService = createAdminLiveOpsService(env);

  router.get(
    '/dashboard',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      const data = await dashboardService.getDashboard();
      res.json({ data });
    }),
  );

  router.get(
    '/health',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      const data = await dashboardService.getDashboard();
      res.json({ data: { health: data.health, deployment: data.deployment, maintenance: data.maintenance } });
    }),
  );

  router.post(
    '/actions/recompute-leaderboards',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const log = req.log ?? logger;
      await runLeaderboardDailyCron(log);
      clearDashboardCache();
      await adminAuditService.log({
        actorId: req.user.id,
        action: 'leaderboard_recompute',
      });
      res.json({ data: { ok: true } });
    }),
  );

  router.patch(
    '/settings/maintenance',
    ...requireAdminMutation,
    validateBody(adminMaintenancePatchBodySchema),
    asyncHandler(async (req, res) => {
      const data = await setMaintenanceMode({
        maintenanceMode: req.body.maintenanceMode,
        maintenanceMessage: req.body.maintenanceMessage ?? '',
        updatedBy: req.user.id,
      });
      clearDashboardCache();
      await adminAuditService.log({
        actorId: req.user.id,
        action: 'maintenance_toggle',
        metadata: { maintenanceMode: data.maintenanceMode },
      });
      res.json({ data });
    }),
  );

  router.get(
    '/feedback',
    ...requireAdmin,
    validateQuery(adminFeedbackQuerySchema),
    asyncHandler(async (req, res) => {
      const data = await feedbackService.listIssues({
        page: req.query.page,
        perPage: req.query.perPage,
        state: req.query.state,
      });
      res.json({ data });
    }),
  );

  router.get(
    '/users/export',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
      res.write('email,username,signup_date,last_active,is_active\n');

      const cursor = userRepository.exportUsersCursor();
      for await (const user of cursor) {
        const email = String(user.email ?? '').replace(/"/g, '""');
        const username = String(user.username ?? '').replace(/"/g, '""');
        const signup = user.createdAt ? new Date(user.createdAt).toISOString() : '';
        const lastActive = user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : '';
        const active = user.isActive ? 'true' : 'false';
        res.write(`"${email}","${username}","${signup}","${lastActive}","${active}"\n`);
      }
      res.end();
    }),
  );

  router.get(
    '/users',
    ...requireAdmin,
    validateQuery(adminUserSearchQuerySchema),
    asyncHandler(async (req, res) => {
      const { users, total, page, limit } = await userService.searchUsers(req.query.q, {
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({
        data: {
          users: users.map((u) => ({
            id: String(u._id),
            username: u.username,
            email: u.email,
            roles: u.roles,
            isActive: u.isActive,
            authProviders: u.authProviders,
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt,
            moderation: u.moderation ?? { status: 'none' },
          })),
          total,
          page,
          limit,
        },
      });
    }),
  );

  router.get(
    '/users/:id',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const data = await userService.getUserDetail(req.params.id);
      res.json({ data });
    }),
  );

  router.patch(
    '/users/:id',
    ...requireAdminMutation,
    validateBody(adminUserPatchBodySchema),
    asyncHandler(async (req, res) => {
      const user = await userService.updateUser(req.user.id, req.params.id, req.body);
      clearDashboardCache();
      res.json({ data: { user } });
    }),
  );

  router.delete(
    '/users/:id/avatar',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const user = await userService.removeAvatar(req.user.id, req.params.id);
      res.json({ data: { user } });
    }),
  );

  router.get(
    '/users/:id/stats',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const stats = await userService.getStats(req.params.id);
      res.json({ data: { stats } });
    }),
  );

  router.patch(
    '/users/:id/stats',
    ...requireAdminMutation,
    validateBody(adminStatsPatchBodySchema),
    asyncHandler(async (req, res) => {
      const stats = await userService.patchStats(req.user.id, req.params.id, req.body.patch);
      res.json({ data: { stats } });
    }),
  );

  router.get(
    '/users/:id/matches',
    ...requireAdmin,
    validateQuery(adminMatchHistoryQuerySchema),
    asyncHandler(async (req, res) => {
      const data = await userService.getMatchHistory(req.params.id, {
        limit: req.query.limit,
        skip: req.query.skip,
        game: req.query.game,
      });
      res.json({ data });
    }),
  );

  router.get(
    '/users/:id/audit',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const skip = Math.max(0, Number(req.query.skip) || 0);
      const entries = await userService.listAudit(req.user.id, req.params.id, { limit, skip });
      res.json({
        data: {
          entries: entries.map((e) => ({
            id: String(e._id),
            action: e.action,
            actorId: String(e.actorId),
            reason: e.reason,
            metadata: e.metadata,
            createdAt: e.createdAt,
          })),
        },
      });
    }),
  );

  router.get(
    '/users/:id/sessions',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const sessions = await adminAuthSecurityService.listUserSessions(req.params.id);
      res.json({ data: { sessions } });
    }),
  );

  router.post(
    '/users/:id/sessions/revoke-all',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.revokeAllSessions(req.user.id, req.params.id);
      res.json({ data });
    }),
  );

  router.post(
    '/users/:id/sessions/:jti/revoke',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.revokeSession(
        req.user.id,
        req.params.id,
        req.params.jti,
      );
      res.json({ data });
    }),
  );

  router.get(
    '/auth/oauth-audit',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      const data = await adminAuthSecurityService.getOAuthAudit();
      res.json({ data });
    }),
  );

  router.get(
    '/auth/oauth-tickets',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      const data = await adminAuthSecurityService.getOAuthTickets();
      res.json({ data });
    }),
  );

  router.post(
    '/auth/oauth-tickets/purge-expired',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.purgeExpiredOAuthTickets(req.user.id);
      res.json({ data });
    }),
  );

  router.get(
    '/auth/abuse-monitor',
    ...requireAdmin,
    validateQuery(adminAbuseQuerySchema),
    asyncHandler(async (req, res) => {
      const data = adminAuthSecurityService.getAbuseMonitor({ limit: req.query.limit });
      res.json({ data });
    }),
  );

  router.patch(
    '/settings/oauth',
    ...requireAdminMutation,
    validateBody(adminOAuthPatchBodySchema),
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.patchGoogleOAuth(
        req.user.id,
        req.body.googleOAuthEnabled,
      );
      clearDashboardCache();
      res.json({ data });
    }),
  );

  router.patch(
    '/settings/games',
    ...requireAdminMutation,
    validateBody(adminGamesPatchBodySchema),
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.patchDisabledGames(
        req.user.id,
        req.body.disabledGames,
      );
      clearDashboardCache();
      res.json({ data });
    }),
  );

  router.patch(
    '/settings/room-creation',
    ...requireAdminMutation,
    validateBody(adminRoomCreationPatchBodySchema),
    asyncHandler(async (req, res) => {
      const data = await adminAuthSecurityService.patchBlockNewRooms(
        req.user.id,
        req.body.blockNewRooms,
      );
      clearDashboardCache();
      res.json({ data });
    }),
  );

  router.get(
    '/realtime/sockets',
    ...requireAdmin,
    asyncHandler(async (_req, res) => {
      const data = await liveOpsService.getSocketCounts();
      res.json({ data });
    }),
  );

  router.get(
    '/rooms',
    ...requireAdmin,
    validateQuery(adminRoomsQuerySchema),
    asyncHandler(async (req, res) => {
      const data = liveOpsService.listRooms(req.query.game);
      res.json({ data });
    }),
  );

  router.get(
    '/rooms/:game/:code',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const data = liveOpsService.getRoom(req.params.game, req.params.code);
      res.json({ data });
    }),
  );

  router.post(
    '/rooms/:game/:code/close',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const data = await liveOpsService.forceCloseRoom(
        req.user.id,
        req.params.game,
        req.params.code,
        typeof req.body?.reason === 'string' ? req.body.reason : '',
      );
      clearDashboardCache();
      res.json({ data });
    }),
  );

  router.post(
    '/rooms/:game/:code/kick',
    ...requireAdminMutation,
    validateBody(adminRoomKickBodySchema),
    asyncHandler(async (req, res) => {
      const data = await liveOpsService.kickPlayer(
        req.user.id,
        req.params.game,
        req.params.code,
        req.body.userId,
      );
      res.json({ data });
    }),
  );

  router.get(
    '/npat/rooms',
    ...requireAdmin,
    validateQuery(adminNpatListQuerySchema),
    asyncHandler(async (req, res) => {
      const rooms = await liveOpsService.listNpatMongoRooms({ limit: req.query.limit });
      res.json({ data: { rooms } });
    }),
  );

  router.get(
    '/npat/rooms/:code',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const room = await liveOpsService.getNpatMongoRoom(req.params.code);
      res.json({ data: { room } });
    }),
  );

  router.get(
    '/npat/eval-failures',
    ...requireAdmin,
    validateQuery(adminNpatListQuerySchema),
    asyncHandler(async (req, res) => {
      const failures = await liveOpsService.listNpatEvalFailures({ limit: req.query.limit });
      res.json({ data: { failures } });
    }),
  );

  router.post(
    '/npat/rooms/:code/retry-eval',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const data = await liveOpsService.retryNpatEval(req.user.id, req.params.code);
      res.json({ data });
    }),
  );

  // ── Fibbage prompt CRUD ─────────────────────────────────────────
  router.get(
    '/fibbage/prompts',
    ...requireAdmin,
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const skip = (page - 1) * limit;
      const filter = { datasetVersion: 'fibbage-v1' };
      if (req.query.category) filter.category = String(req.query.category);
      if (req.query.q) {
        filter.$or = [
          { text: { $regex: String(req.query.q), $options: 'i' } },
          { answer: { $regex: String(req.query.q), $options: 'i' } },
        ];
      }
      const [prompts, total] = await Promise.all([
        FibbagePrompt.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FibbagePrompt.countDocuments(filter),
      ]);
      res.json({ data: { prompts, total, page } });
    }),
  );

  router.post(
    '/fibbage/prompts',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const { text, answer, category, difficulty } = req.body;
      if (!text || !answer || !category) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'text, answer, and category are required' } });
      }
      const { createHash } = await import('node:crypto');
      const textHash = createHash('sha256').update(String(text).trim().toLowerCase()).digest('hex').slice(0, 16);
      const sourceId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const prompt = await FibbagePrompt.create({
        sourceId,
        datasetVersion: 'fibbage-v1',
        text: String(text).trim(),
        answer: String(answer).trim(),
        category: String(category).trim(),
        difficulty: Number(difficulty) || 2,
        textHash,
        locale: 'en',
        active: true,
      });
      await adminAuditService.log({
        actorId: req.user.id,
        action: 'fibbage_prompt_created',
        metadata: { promptId: prompt._id.toString(), text: prompt.text },
      });
      res.status(201).json({ data: { prompt } });
    }),
  );

  router.patch(
    '/fibbage/prompts/:id',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const { text, answer, category, difficulty, active } = req.body;
      const update = {};
      if (text !== undefined) update.text = String(text).trim();
      if (answer !== undefined) update.answer = String(answer).trim();
      if (category !== undefined) update.category = String(category).trim();
      if (difficulty !== undefined) update.difficulty = Number(difficulty);
      if (active !== undefined) update.active = Boolean(active);
      if (update.text) {
        const { createHash } = await import('node:crypto');
        update.textHash = createHash('sha256').update(update.text.toLowerCase()).digest('hex').slice(0, 16);
      }
      const prompt = await FibbagePrompt.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, lean: true });
      if (!prompt) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } });
      await adminAuditService.log({
        actorId: req.user.id,
        action: 'fibbage_prompt_updated',
        metadata: { promptId: req.params.id, ...update },
      });
      res.json({ data: { prompt } });
    }),
  );

  router.delete(
    '/fibbage/prompts/:id',
    ...requireAdminMutation,
    asyncHandler(async (req, res) => {
      const result = await FibbagePrompt.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' } });
      await adminAuditService.log({
        actorId: req.user.id,
        action: 'fibbage_prompt_deleted',
        metadata: { promptId: req.params.id },
      });
      res.json({ data: { deleted: true } });
    }),
  );

  return router;
}
