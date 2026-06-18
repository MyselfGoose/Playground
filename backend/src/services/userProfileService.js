import { AppError } from '../errors/AppError.js';
import { userRepository } from '../repositories/userRepository.js';
import { decodeFeedbackScreenshot } from './feedbackScreenshot.js';
import { processAvatarImage, validateAvatarEmoji } from './avatarImageProcessing.js';
import { resolveUserAvatar } from '../utils/resolveUserAvatar.js';
import { getSocialHub } from '../realtime/socialHub.js';
import { invalidateUserCaches } from '../routes/userProfileCache.js';

/**
 * @param {import('../config/env.js').Env} env
 * @param {ReturnType<import('./avatarStorage.js').createAvatarStorage>} avatarStorage
 */
export function createUserProfileService(env, avatarStorage) {
  const cooldownMs = env.USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  /**
   * @param {{ _id?: unknown, id?: unknown, username?: string, avatarUrl?: string | null, avatarEmoji?: string | null, usernameChangedAt?: Date | null, createdAt?: Date | null }} user
   */
  function serializeUser(user) {
    const id = user._id != null ? String(user._id) : user.id != null ? String(user.id) : '';
    const { avatarUrl, avatarEmoji } = resolveUserAvatar(user);
    return {
      id,
      userId: id,
      username: user.username ?? '',
      avatarUrl,
      avatarEmoji,
      usernameChangedAt: user.usernameChangedAt ?? null,
      createdAt: user.createdAt ?? null,
    };
  }

  /**
   * @param {{ userId: string, username: string, avatarUrl: string | null, avatarEmoji: string | null }} payload
   */
  async function broadcastProfileUpdated(payload) {
    const hub = getSocialHub();
    if (!hub) return;
    await hub.notifyProfileUpdated(payload.userId, payload);
    await hub.notifyFriendsProfileUpdated(payload.userId, payload);
  }

  /**
   * @param {string} storedUrl
   */
  function isManagedAvatarUrl(storedUrl) {
    if (!storedUrl) return false;
    const base = (env.AVATAR_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
    if (base && storedUrl.startsWith(base)) return true;
    if (env.AVATAR_STORAGE_DRIVER === 'local' && storedUrl.includes('/api/v1/users/avatars/')) return true;
    if (env.AVATAR_S3_BUCKET && storedUrl.includes(env.AVATAR_S3_BUCKET)) return true;
    return storedUrl.endsWith('.webp');
  }

  return {
    serializeUser,

    /**
     * @param {string} userId
     * @param {{ username?: string }} body
     */
    async updateProfile(userId, body) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      const nextUsername = body.username;
      if (!nextUsername) {
        throw new AppError(400, 'No changes provided', { code: 'VALIDATION_ERROR', expose: true });
      }

      if (nextUsername === user.username) {
        throw new AppError(400, 'Username unchanged', { code: 'VALIDATION_ERROR', expose: true });
      }

      if (user.usernameChangedAt) {
        const elapsed = Date.now() - new Date(user.usernameChangedAt).getTime();
        if (elapsed < cooldownMs) {
          const retryAt = new Date(new Date(user.usernameChangedAt).getTime() + cooldownMs);
          throw new AppError(429, 'Username change cooldown active', {
            code: 'USERNAME_CHANGE_COOLDOWN',
            expose: true,
            user_message: `You can change your username again on ${retryAt.toISOString().slice(0, 10)}.`,
          });
        }
      }

      const taken = await userRepository.findByUsernameExcluding(nextUsername, userId);
      if (taken) {
        throw new AppError(409, 'Username taken', { code: 'USERNAME_TAKEN', expose: true });
      }

      let updated;
      try {
        updated = await userRepository.updateProfile(userId, {
          username: nextUsername,
          usernameChangedAt: new Date(),
        });
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
          throw new AppError(409, 'Username taken', { code: 'USERNAME_TAKEN', expose: true });
        }
        throw err;
      }

      if (!updated) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      invalidateUserCaches(userId);
      const payload = serializeUser(updated);
      await broadcastProfileUpdated(payload);
      return payload;
    },

    /**
     * @param {string} userId
     * @param {{ image: { mime?: string, data: string } }} body
     */
    async uploadAvatar(userId, body) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      const decoded = decodeFeedbackScreenshot(body.image, env.AVATAR_MAX_BYTES);
      if (!decoded.ok) {
        throw new AppError(400, decoded.message, { code: 'VALIDATION_ERROR', expose: true });
      }

      const processed = await processAvatarImage(decoded.buffer, env.AVATAR_MAX_BYTES);
      if (!processed.ok) {
        throw new AppError(400, processed.message, { code: 'VALIDATION_ERROR', expose: true });
      }

      const previousUrl = user.avatarUrl;
      const publicUrl = await avatarStorage.save(userId, processed.buffer);
      const versionedUrl = `${publicUrl}?v=${Date.now()}`;

      const updated = await userRepository.updateProfile(userId, {
        avatarUrl: versionedUrl,
        avatarEmoji: null,
        avatarUpdatedAt: new Date(),
      });

      if (!updated) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      if (previousUrl && isManagedAvatarUrl(previousUrl)) {
        await avatarStorage.deleteByUrl(previousUrl);
      }

      invalidateUserCaches(userId);
      const payload = serializeUser(updated);
      await broadcastProfileUpdated(payload);
      return payload;
    },

    /**
     * @param {string} userId
     * @param {{ emoji: string }} body
     */
    async setAvatarEmoji(userId, body) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      const validated = validateAvatarEmoji(body.emoji);
      if (!validated.ok) {
        throw new AppError(400, validated.message, { code: 'VALIDATION_ERROR', expose: true });
      }

      const previousUrl = user.avatarUrl;
      const updated = await userRepository.updateProfile(userId, {
        avatarEmoji: validated.emoji,
        avatarUrl: null,
        avatarUpdatedAt: new Date(),
      });

      if (!updated) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      if (previousUrl && isManagedAvatarUrl(previousUrl)) {
        await avatarStorage.deleteByUrl(previousUrl);
      }

      invalidateUserCaches(userId);
      const payload = serializeUser(updated);
      await broadcastProfileUpdated(payload);
      return payload;
    },

    /**
     * @param {string} userId
     */
    async removeAvatar(userId) {
      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      const previousUrl = user.avatarUrl;
      const updated = await userRepository.updateProfile(userId, {
        avatarUrl: null,
        avatarEmoji: null,
        avatarUpdatedAt: new Date(),
      });

      if (!updated) {
        throw new AppError(404, 'User not found', { code: 'USER_NOT_FOUND', expose: true });
      }

      if (previousUrl && isManagedAvatarUrl(previousUrl)) {
        await avatarStorage.deleteByUrl(previousUrl);
      }

      invalidateUserCaches(userId);
      const payload = serializeUser(updated);
      await broadcastProfileUpdated(payload);
      return payload;
    },
  };
}
