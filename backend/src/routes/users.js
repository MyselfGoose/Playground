import mongoose from 'mongoose';
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { userRepository } from '../repositories/userRepository.js';
import { userStatsRepository } from '../repositories/userStatsRepository.js';
import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';

const cache = new Map();
const CACHE_TTL = 45_000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function avatarUrl(username) {
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(username || 'player')}`;
}

function computeBreakdown(stats) {
  const totalGames = (stats?.typing_totalGames ?? 0) + (stats?.npat_totalGames ?? 0);
  return {
    typing: Math.round(Math.min((stats?.typing_bestWpm ?? 0) / 150, 1) * 100 * 100) / 100,
    accuracy: Math.round((stats?.typing_weightedAccuracy ?? 0) * 100) / 100,
    npat: Math.round(Math.min((stats?.npat_averageScore ?? 0) / 35, 1) * 100 * 100) / 100,
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

export function createUsersRouter() {
  const router = Router();

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

      const [wpmRank, accuracyRank, npatRank] = await Promise.all([
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
      ]);

      const totalGames = (stats?.typing_totalGames ?? 0) + (stats?.npat_totalGames ?? 0);
      const breakdown = computeBreakdown(stats);
      const recentActivity = [...typingActivity.map(mapTypingActivity), ...npatActivity.map(mapNpatActivity)]
        .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
        .slice(0, timelineLimit);

      const payload = {
        user: {
          id: String(user._id),
          username: user.username,
          avatarUrl: avatarUrl(user.username),
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

  return router;
}
