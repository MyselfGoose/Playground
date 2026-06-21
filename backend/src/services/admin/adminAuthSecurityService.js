import { AppError } from '../../errors/AppError.js';
import { User } from '../../models/User.js';
import { refreshSessionRepository } from '../../repositories/refreshSessionRepository.js';
import { oauthCompletionTicketRepository } from '../../repositories/oauthCompletionTicketRepository.js';
import { oauthSignupTicketRepository } from '../../repositories/oauthSignupTicketRepository.js';
import { userRepository } from '../../repositories/userRepository.js';
import { getAuthAbuseSnapshot } from '../../observability/authAbuseMonitor.js';
import {
  setGoogleOAuthEnabled,
  setBlockNewRooms,
  setDisabledGames,
  getPlatformSettingsCached,
} from '../platformSettingsService.js';
import { adminAuditService } from './adminAuditService.js';
import { GAME_SLUGS } from '../../utils/gameAvailability.js';

export function createAdminAuthSecurityService() {
  return {
    /**
     * @param {string} userId
     */
    async listUserSessions(userId) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      const rows = await refreshSessionRepository.listActiveByUserId(userId);
      return rows.map((s) => ({
        jti: s.jti,
        userAgent: s.userAgent ?? null,
        createdFromIp: s.createdFromIp ?? null,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));
    },

    /**
     * @param {string} actorId
     * @param {string} targetUserId
     * @param {string} jti
     */
    async revokeSession(actorId, targetUserId, jti) {
      const user = await userRepository.findByIdLean(targetUserId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      const ok = await refreshSessionRepository.revokeByJtiForUser(targetUserId, jti);
      if (!ok) {
        throw new AppError(404, 'Session not found', { code: 'SESSION_NOT_FOUND', expose: true });
      }
      await adminAuditService.log({
        actorId,
        targetUserId,
        action: 'session_revoke',
        metadata: { jti },
      });
      return { ok: true };
    },

    /**
     * @param {string} actorId
     * @param {string} targetUserId
     */
    async revokeAllSessions(actorId, targetUserId) {
      const user = await userRepository.findByIdLean(targetUserId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      await refreshSessionRepository.revokeAllForUser(targetUserId);
      await adminAuditService.log({
        actorId,
        targetUserId,
        action: 'sessions_revoke_all',
      });
      return { ok: true };
    },

    async getOAuthAudit() {
      const [googleOnly, localOnly, both, recentLinks] = await Promise.all([
        User.countDocuments({
          googleId: { $ne: null },
          $or: [{ passwordHash: null }, { passwordHash: { $exists: false } }],
        }),
        User.countDocuments({
          $or: [{ googleId: null }, { googleId: { $exists: false } }],
          passwordHash: { $ne: null },
        }),
        User.countDocuments({
          googleId: { $ne: null },
          passwordHash: { $ne: null },
        }),
        User.find({ googleId: { $ne: null } })
          .sort({ updatedAt: -1 })
          .limit(20)
          .select('email username googleId authProviders updatedAt createdAt')
          .lean(),
      ]);

      return {
        counts: { googleOnly, localOnly, both },
        recentGoogleLinks: recentLinks.map((u) => ({
          id: String(u._id),
          email: u.email,
          username: u.username,
          authProviders: u.authProviders ?? [],
          linkedAt: u.updatedAt ?? u.createdAt,
        })),
      };
    },

    async getOAuthTickets() {
      const [completionPending, signupPending, completion, signup] = await Promise.all([
        oauthCompletionTicketRepository.countPending(),
        oauthSignupTicketRepository.countPending(),
        oauthCompletionTicketRepository.listPending(30),
        oauthSignupTicketRepository.listPending(30),
      ]);

      return {
        counts: { completionPending, signupPending },
        completionTickets: completion.map((t) => ({
          jti: t.jti,
          userId: String(t.userId),
          expiresAt: t.expiresAt,
        })),
        signupTickets: signup.map((t) => ({
          jti: t.jti,
          email: t.email,
          googleId: t.googleId,
          name: t.name,
          expiresAt: t.expiresAt,
        })),
      };
    },

    /**
     * @param {string} actorId
     */
    async purgeExpiredOAuthTickets(actorId) {
      const [completion, signup] = await Promise.all([
        oauthCompletionTicketRepository.deleteExpired(),
        oauthSignupTicketRepository.deleteExpired(),
      ]);
      const deleted =
        (completion.deletedCount ?? 0) + (signup.deletedCount ?? 0);
      await adminAuditService.log({
        actorId,
        action: 'oauth_tickets_purge',
        metadata: { deleted },
      });
      return { deleted };
    },

    getAbuseMonitor(opts) {
      return getAuthAbuseSnapshot(opts);
    },

    getPlatformAuthSettings() {
      const s = getPlatformSettingsCached();
      return {
        googleOAuthEnabled: s.googleOAuthEnabled,
        blockNewRooms: s.blockNewRooms,
        disabledGames: s.disabledGames,
        availableGames: [...GAME_SLUGS],
      };
    },

    /**
     * @param {string} actorId
     * @param {boolean} googleOAuthEnabled
     */
    async patchGoogleOAuth(actorId, googleOAuthEnabled) {
      const data = await setGoogleOAuthEnabled({ googleOAuthEnabled, updatedBy: actorId });
      await adminAuditService.log({
        actorId,
        action: 'oauth_toggle',
        metadata: { googleOAuthEnabled: data.googleOAuthEnabled },
      });
      return data;
    },

    /**
     * @param {string} actorId
     * @param {boolean} blockNewRooms
     */
    async patchBlockNewRooms(actorId, blockNewRooms) {
      const data = await setBlockNewRooms({ blockNewRooms, updatedBy: actorId });
      await adminAuditService.log({
        actorId,
        action: 'room_creation_block_toggle',
        metadata: { blockNewRooms: data.blockNewRooms },
      });
      return data;
    },

    /**
     * @param {string} actorId
     * @param {string[]} disabledGames
     */
    async patchDisabledGames(actorId, disabledGames) {
      const invalid = disabledGames.filter((g) => !GAME_SLUGS.includes(g));
      if (invalid.length) {
        throw new AppError(400, 'Invalid game slug', {
          code: 'VALIDATION_ERROR',
          expose: true,
        });
      }
      const data = await setDisabledGames({ disabledGames, updatedBy: actorId });
      await adminAuditService.log({
        actorId,
        action: 'game_disable_toggle',
        metadata: { disabledGames: data.disabledGames },
      });
      return data;
    },
  };
}

export const adminAuthSecurityService = createAdminAuthSecurityService();
