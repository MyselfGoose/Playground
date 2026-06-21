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
import { adminAuditService } from '../services/admin/adminAuditService.js';
import { setMaintenanceMode } from '../services/platformSettingsService.js';
import { runLeaderboardDailyCron } from '../jobs/leaderboardCron.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  adminUserSearchQuerySchema,
  adminUserPatchBodySchema,
  adminStatsPatchBodySchema,
  adminMaintenancePatchBodySchema,
  adminMatchHistoryQuerySchema,
  adminFeedbackQuerySchema,
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

  return router;
}
