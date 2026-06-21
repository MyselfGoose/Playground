import mongoose from 'mongoose';
import { AppError } from '../../errors/AppError.js';
import { userRepository } from '../../repositories/userRepository.js';
import { refreshSessionRepository } from '../../repositories/refreshSessionRepository.js';
import { userStatsRepository } from '../../repositories/userStatsRepository.js';
import { createUserProfileService } from '../userProfileService.js';
import { createAvatarStorage } from '../avatarStorage.js';
import { adminAuditService } from './adminAuditService.js';
import { adminStatsService } from './adminStatsService.js';
import { getAdminMatchHistoryForUser } from './adminMatchHistoryService.js';
import { invalidateUserCaches } from '../../routes/userProfileCache.js';

const ALLOWED_ROLES = new Set(['user', 'admin', 'moderator']);

/**
 * @param {import('../../config/env.js').Env} env
 */
export function createAdminUserService(env) {
  const avatarStorage = createAvatarStorage(env);
  const userProfileService = createUserProfileService(env, avatarStorage);

  /**
   * @param {string} actorId
   * @param {string} targetId
   */
  function assertNotSelf(actorId, targetId, action) {
    if (String(actorId) === String(targetId)) {
      throw new AppError(400, `Cannot ${action} your own account`, { code: 'SELF_ACTION_FORBIDDEN', expose: true });
    }
  }

  /**
   * @param {Record<string, unknown>} user
   */
  function serializeAdminUser(user) {
    const id = String(user._id ?? user.id);
    return {
      id,
      username: user.username,
      email: user.email,
      googleId: user.googleId ?? null,
      authProviders: user.authProviders ?? ['local'],
      avatarUrl: user.avatarUrl ?? null,
      avatarEmoji: user.avatarEmoji ?? null,
      roles: user.roles ?? ['user'],
      isActive: Boolean(user.isActive),
      moderation: user.moderation ?? { status: 'none' },
      usernameChangedAt: user.usernameChangedAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? null,
      updatedAt: user.updatedAt ?? null,
    };
  }

  return {
    /**
     * @param {string} query
     * @param {{ page?: number, limit?: number }} [opts]
     */
    async searchUsers(query, opts) {
      return userRepository.searchUsers(query, opts);
    },

    /**
     * @param {string} userId
     */
    async getUserDetail(userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid user id', { code: 'VALIDATION_ERROR', expose: true });
      }
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      const stats = await userStatsRepository.findByUserId(userId);
      return { user: serializeAdminUser(user), stats: stats ?? null };
    },

    /**
     * @param {string} actorId
     * @param {string} targetId
     * @param {Record<string, unknown>} body
     */
    async updateUser(actorId, targetId, body) {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        throw new AppError(400, 'Invalid user id', { code: 'VALIDATION_ERROR', expose: true });
      }

      const user = await userRepository.findByIdLean(targetId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      const patch = {};
      const auditMeta = {};

      if (typeof body.isActive === 'boolean' && body.isActive !== user.isActive) {
        assertNotSelf(actorId, targetId, 'deactivate');
        patch.isActive = body.isActive;
        auditMeta.isActive = body.isActive;
        if (!body.isActive) {
          await refreshSessionRepository.revokeAllForUser(targetId);
        }
        await adminAuditService.log({
          actorId,
          targetUserId: targetId,
          action: body.isActive ? 'user_activate' : 'user_deactivate',
          reason: typeof body.reason === 'string' ? body.reason : '',
          metadata: auditMeta,
        });
      }

      if (Array.isArray(body.roles)) {
        assertNotSelf(actorId, targetId, 'change roles for');
        const roles = body.roles.filter((r) => typeof r === 'string' && ALLOWED_ROLES.has(r));
        if (roles.length === 0 || !roles.includes('user')) {
          throw new AppError(400, 'Roles must include user', { code: 'VALIDATION_ERROR', expose: true });
        }
        if (!roles.includes('admin') && user.roles?.includes('admin') && String(actorId) === String(targetId)) {
          throw new AppError(400, 'Cannot remove your own admin role', { code: 'SELF_ACTION_FORBIDDEN', expose: true });
        }
        patch.roles = [...new Set(roles)];
        await adminAuditService.log({
          actorId,
          targetUserId: targetId,
          action: 'user_roles_update',
          reason: typeof body.reason === 'string' ? body.reason : '',
          metadata: { roles: patch.roles },
        });
      }

      if (typeof body.username === 'string' && body.username.trim() && body.username !== user.username) {
        const nextUsername = body.username.trim();
        const taken = await userRepository.findByUsernameExcluding(nextUsername, targetId);
        if (taken) {
          throw new AppError(409, 'Username taken', { code: 'USERNAME_TAKEN', expose: true });
        }
        patch.username = nextUsername;
        patch.usernameChangedAt = new Date();
        await adminAuditService.log({
          actorId,
          targetUserId: targetId,
          action: 'user_username_force',
          reason: typeof body.reason === 'string' ? body.reason : '',
          metadata: { from: user.username, to: nextUsername },
        });
      }

      if (body.moderation && typeof body.moderation === 'object') {
        assertNotSelf(actorId, targetId, 'moderate');
        const mod = body.moderation;
        const status = mod.status;
        if (!['none', 'suspended', 'banned'].includes(status)) {
          throw new AppError(400, 'Invalid moderation status', { code: 'VALIDATION_ERROR', expose: true });
        }
        patch.moderation = {
          status,
          reason: typeof mod.reason === 'string' ? mod.reason.slice(0, 2000) : '',
          expiresAt: mod.expiresAt ? new Date(mod.expiresAt) : null,
          internalNotes: typeof mod.internalNotes === 'string' ? mod.internalNotes.slice(0, 5000) : '',
          updatedAt: new Date(),
          updatedBy: new mongoose.Types.ObjectId(actorId),
        };
        if (status === 'banned' || status === 'suspended') {
          await refreshSessionRepository.revokeAllForUser(targetId);
        }
        await adminAuditService.log({
          actorId,
          targetUserId: targetId,
          action: 'user_moderation_update',
          reason: patch.moderation.reason,
          metadata: { status, expiresAt: patch.moderation.expiresAt },
        });
      }

      if (Object.keys(patch).length === 0) {
        throw new AppError(400, 'No changes provided', { code: 'VALIDATION_ERROR', expose: true });
      }

      const updated = await userRepository.updateProfile(targetId, patch);
      if (!updated) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }
      invalidateUserCaches(targetId);
      return serializeAdminUser(updated);
    },

    /**
     * @param {string} actorId
     * @param {string} targetId
     */
    async removeAvatar(actorId, targetId) {
      await userProfileService.removeAvatar(targetId);
      await adminAuditService.log({
        actorId,
        targetUserId: targetId,
        action: 'user_avatar_remove',
      });
      const user = await userRepository.findByIdLean(targetId);
      return serializeAdminUser(user);
    },

    getStats: adminStatsService.getStats,
    /**
     * @param {string} actorId
     * @param {string} targetId
     * @param {Record<string, number>} patch
     */
    async patchStats(actorId, targetId, patch) {
      const stats = await adminStatsService.patchStats(targetId, patch);
      await adminAuditService.log({
        actorId,
        targetUserId: targetId,
        action: 'user_stats_patch',
        metadata: { fields: Object.keys(patch) },
      });
      return stats;
    },

    getMatchHistory: getAdminMatchHistoryForUser,

    listAudit(actorId, targetId, opts) {
      return adminAuditService.listForUser(targetId, opts);
    },
  };
}
