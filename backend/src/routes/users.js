import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { createAuthMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { userRepository } from '../repositories/userRepository.js';
import { HANGMAN_LEADERBOARD_MIN_GAMES, userStatsRepository } from '../repositories/userStatsRepository.js';
import { FIBBAGE_LEADERBOARD_MIN_GAMES } from '../games/fibbage/constants.js';
import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';
import { getMatchHistoryForUser } from '../services/matchHistoryService.js';
import { requireMongoReady } from './requireMongoReady.js';
import { cacheGet, cacheSet } from './userProfileCache.js';
import { userAvatarFields } from '../utils/resolveUserAvatar.js';
import { createAvatarStorage } from '../services/avatarStorage.js';
import { createUserProfileService } from '../services/userProfileService.js';
import {
  avatarEmojiBodySchema,
  avatarUploadBodySchema,
  updateProfileBodySchema,
} from '../validation/users.schemas.js';

function computeBreakdown(stats) {
  const totalGames =
    (stats?.typing_totalGames ?? 0) +
    (stats?.npat_totalGames ?? 0) +
    (stats?.taboo_gamesPlayed ?? 0) +
    (stats?.cah_gamesPlayed ?? 0) +
    (stats?.hangman_totalGames ?? 0) +
    (stats?.fibbage_gamesPlayed ?? 0);
  return {
    typing: Math.round(Math.min((stats?.typing_bestWpm ?? 0) / 150, 1) * 100 * 100) / 100,
    accuracy: Math.round((stats?.typing_weightedAccuracy ?? 0) * 100) / 100,
    npat: Math.round(Math.min((stats?.npat_averageScore ?? 0) / 35, 1) * 100 * 100) / 100,
    taboo: Math.round(stats?.taboo_score ?? 0),
    cah: Math.round(stats?.cah_score ?? 0),
    hangman: Math.round(stats?.hangman_skill ?? 0),
    fibbage: Math.round(stats?.fibbage_score ?? 0),
    activity: Math.round(Math.min(totalGames / 100, 1) * 100 * 100) / 100,
    consistency: Math.round(Math.min((stats?.activeDaysLast30 ?? 0) / 20, 1) * 100 * 100) / 100,
  };
}

function rankingExplanation(breakdown) {
  const sorted = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);
  const label = {
    typing: 'typing speed',
    accuracy: 'typing accuracy',
    npat: 'NPAT performance',
    hangman: 'Hangman performance',
    fibbage: 'Fibbage deception',
    activity: 'overall activity',
    consistency: 'daily consistency',
  };
  const first = label[sorted[0]] ?? 'overall performance';
  const second = label[sorted[1]] ?? 'recent activity';
  return `Rank is primarily driven by ${first} and ${second}.`;
}

function mapTypingActivity(entry) {
  return {
    type: 'typing',
    finishedAt: entry.finishedAt,
    summary: {
      mode: entry.mode,
      wpm: entry.wpm ?? 0,
      accuracy: entry.accuracy ?? 0,
      rank: entry.rank ?? null,
      playerCount: entry.playerCount ?? 1,
    },
  };
}

function mapNpatActivity(entry) {
  return {
    type: 'npat',
    finishedAt: entry.finishedAt,
    summary: {
      mode: entry.mode,
      totalScore: entry.totalScore ?? 0,
      averageScore: entry.averageScore ?? 0,
      outcome: entry.outcome ?? 'solo',
      playerCount: entry.playerCount ?? 1,
    },
  };
}

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createUsersRouter({ env }) {
  const router = Router();
  router.use(requireMongoReady);

  const tokenService = createTokenService(env);
  const { requireAuth } = createAuthMiddleware({ tokenService });
  const avatarStorage = createAvatarStorage(env);
  const profileService = createUserProfileService(env, avatarStorage);

  const profilePatchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    message: { error: { message: 'Too many profile updates', code: 'RATE_LIMITED' } },
  });

  const avatarUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
    message: { error: { message: 'Too many avatar uploads', code: 'RATE_LIMITED' } },
  });

  router.get(
    '/avatars/:filename',
    asyncHandler(async (req, res) => {
      if (env.AVATAR_STORAGE_DRIVER !== 'local') {
        return res.status(404).json({
          error: { message: 'Not found', code: 'NOT_FOUND' },
        });
      }
      const filePath = avatarStorage.resolveLocalFile(String(req.params.filename ?? ''));
      if (!filePath) {
        return res.status(404).json({
          error: { message: 'Not found', code: 'NOT_FOUND' },
        });
      }
      try {
        const buf = await readFile(filePath);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buf);
      } catch {
        return res.status(404).json({
          error: { message: 'Not found', code: 'NOT_FOUND' },
        });
      }
    }),
  );

  router.patch(
    '/me',
    requireAuth,
    profilePatchLimiter,
    validateBody(updateProfileBodySchema),
    asyncHandler(async (req, res) => {
      const user = await profileService.updateProfile(req.user.id, req.body);
      res.json({ data: { user } });
    }),
  );

  router.post(
    '/me/avatar',
    requireAuth,
    avatarUploadLimiter,
    validateBody(avatarUploadBodySchema),
    asyncHandler(async (req, res) => {
      const user = await profileService.uploadAvatar(req.user.id, req.body);
      res.json({ data: { user } });
    }),
  );

  router.put(
    '/me/avatar/emoji',
    requireAuth,
    avatarUploadLimiter,
    validateBody(avatarEmojiBodySchema),
    asyncHandler(async (req, res) => {
      const user = await profileService.setAvatarEmoji(req.user.id, req.body);
      res.json({ data: { user } });
    }),
  );

  router.delete(
    '/me/avatar',
    requireAuth,
    avatarUploadLimiter,
    asyncHandler(async (req, res) => {
      const user = await profileService.removeAvatar(req.user.id);
      res.json({ data: { user } });
    }),
  );

  router.get(
    '/:id/profile',
    asyncHandler(async (req, res) => {
      const userId = String(req.params.id || '');
      const timelineLimit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
      const cacheKey = `profile:${userId}:limit=${timelineLimit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({
          error: { message: 'User not found', code: 'USER_NOT_FOUND' },
        });
      }

      const [user, stats, typingActivity, npatActivity] = await Promise.all([
        userRepository.findByIdLean(userId),
        userStatsRepository.findByUserId(userId),
        typingAttemptRepository.findByUser(userId, { limit: timelineLimit, skip: 0 }),
        npatResultRepository.findByUser(userId, { limit: timelineLimit, skip: 0 }),
      ]);

      if (!user) {
        return res.status(404).json({
          error: { message: 'User not found', code: 'USER_NOT_FOUND' },
        });
      }

      const [wpmRank, accuracyRank, npatRank, hangmanRank, fibbageRank] = await Promise.all([
        userStatsRepository.rankFor({
          userId,
          sortField: 'typing_bestWpm',
          minGamesField: 'typing_totalGames',
          minGames: 3,
        }),
        userStatsRepository.rankFor({
          userId,
          sortField: 'typing_weightedAccuracy',
          minGamesField: 'typing_totalGames',
          minGames: 3,
        }),
        userStatsRepository.rankFor({
          userId,
          sortField: 'npat_averageScore',
          minGamesField: 'npat_totalGames',
          minGames: 2,
        }),
        userStatsRepository.rankFor({
          userId,
          sortField: 'hangman_skill',
          minGamesField: 'hangman_totalGames',
          minGames: HANGMAN_LEADERBOARD_MIN_GAMES,
        }),
        userStatsRepository.rankFor({
          userId,
          sortField: 'fibbage_score',
          minGamesField: 'fibbage_gamesPlayed',
          minGames: FIBBAGE_LEADERBOARD_MIN_GAMES,
        }),
      ]);

      const totalGames =
        (stats?.typing_totalGames ?? 0) +
        (stats?.npat_totalGames ?? 0) +
        (stats?.taboo_gamesPlayed ?? 0) +
        (stats?.cah_gamesPlayed ?? 0) +
        (stats?.hangman_totalGames ?? 0) +
        (stats?.fibbage_gamesPlayed ?? 0);
      const breakdown = computeBreakdown(stats);
      const recentActivity = [...typingActivity.map(mapTypingActivity), ...npatActivity.map(mapNpatActivity)]
        .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
        .slice(0, timelineLimit);

      const payload = {
        user: {
          id: String(user._id),
          username: user.username,
          ...userAvatarFields(user),
          createdAt: user.createdAt ?? null,
        },
        stats: {
          typing: {
            bestWpm: stats?.typing_bestWpm ?? 0,
            weightedAccuracy: stats?.typing_weightedAccuracy ?? 0,
            totalGames: stats?.typing_totalGames ?? 0,
            totalChars: stats?.typing_totalCharsTyped ?? 0,
            multiWins: stats?.typing_multiWins ?? 0,
            wpmRank,
            accuracyRank,
          },
          npat: {
            totalScore: stats?.npat_totalScore ?? 0,
            averageScore: stats?.npat_averageScore ?? 0,
            totalGames: stats?.npat_totalGames ?? 0,
            winRate: stats?.npat_winRate ?? 0,
            wins: stats?.npat_wins ?? 0,
            npatRank,
          },
          hangman: {
            skill: stats?.hangman_skill ?? 0,
            totalGames: stats?.hangman_totalGames ?? 0,
            totalWins: stats?.hangman_totalWins ?? 0,
            winRate: stats?.hangman_winRate ?? 0,
            accuracy: stats?.hangman_accuracy ?? 0,
            hangmanRank,
          },
          fibbage: {
            score: stats?.fibbage_score ?? 0,
            gamesPlayed: stats?.fibbage_gamesPlayed ?? 0,
            gamesWon: stats?.fibbage_gamesWon ?? 0,
            winRate: stats?.fibbage_winRate ?? 0,
            foolsEarned: stats?.fibbage_foolsEarned ?? 0,
            truthsFound: stats?.fibbage_truthsFound ?? 0,
            fibbageRank,
          },
          global: {
            score: stats?.global_score ?? 0,
            rank: stats?.global_rank ?? null,
            totalGames,
            consistencyDays: stats?.activeDaysLast30 ?? 0,
            breakdown,
          },
        },
        rankingExplanation: rankingExplanation(breakdown),
        recentActivity,
      };
      cacheSet(cacheKey, payload);
      return res.json({ data: payload });
    }),
  );

  router.get(
    '/:id/matches',
    asyncHandler(async (req, res) => {
      const userId = String(req.params.id || '');
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
      const cacheKey = `matches:${userId}:limit=${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({
          error: { message: 'User not found', code: 'USER_NOT_FOUND' },
        });
      }

      const user = await userRepository.findByIdLean(userId);
      if (!user) {
        return res.status(404).json({
          error: { message: 'User not found', code: 'USER_NOT_FOUND' },
        });
      }

      const payload = await getMatchHistoryForUser(userId, { limit });
      cacheSet(cacheKey, payload);
      return res.json({ data: payload });
    }),
  );

  return router;
}
