import { Router } from 'express';
import { z } from 'zod';
import { createTokenService } from '../services/tokenService.js';
import { readAccessToken, resolveAccessContext } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { userStatsRepository } from '../repositories/userStatsRepository.js';
import { persistTypingAttempt } from '../services/leaderboardStatsService.js';

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const soloTypingSchema = z.object({
  passageLength: z.number().int().min(1).max(100_000),
  correctChars: z.number().int().min(0).max(100_000),
  incorrectChars: z.number().int().min(0).max(100_000),
  extraChars: z.number().int().min(0).max(100_000),
  wpm: z.number().min(0).max(500),
  rawWpm: z.number().min(0).max(500),
  elapsedMs: z.number().min(1).max(3_600_000),
});

/** Simple in-memory TTL cache (60s). */
const cache = new Map();
const CACHE_TTL = 60_000;

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

function mapEntries(entries, skip, primaryField, extraFields = []) {
  return entries.map((e, i) => {
    const base = {
      rank: skip + i + 1,
      userId: String(e.userId),
      username: e.username,
      avatarUrl: avatarUrl(e.username),
      totalGames: (e.typing_totalGames ?? 0) + (e.npat_totalGames ?? 0) + (e.taboo_gamesPlayed ?? 0),
    };
    base[primaryField] = e[primaryField];
    for (const f of extraFields) {
      base[f] = e[f];
    }
    return base;
  });
}

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createLeaderboardRouter({ env }) {
  const router = Router();
  const tokenService = createTokenService(env);

  /** Optional auth — attach user if logged in, proceed either way. */
  async function optionalAuth(req, _res, next) {
    try {
      const token = readAccessToken(req);
      if (token) req.user = await resolveAccessContext(token, { tokenService });
    } catch { /* anonymous */ }
    next();
  }

  /** Require auth for /me. */
  async function requireAuth(req, _res, next) {
    try {
      const token = readAccessToken(req);
      if (!token) return next({ statusCode: 401, message: 'Authentication required', code: 'UNAUTHENTICATED', expose: true });
      req.user = await resolveAccessContext(token, { tokenService });
      next();
    } catch (err) {
      next(err);
    }
  }

  router.get(
    '/typing/wpm',
    asyncHandler(async (req, res) => {
      const { page, limit } = pageQuerySchema.parse(req.query);
      const cacheKey = `typing_wpm:${page}:${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      const result = await userStatsRepository.leaderboard({
        sortField: 'typing_bestWpm',
        minGamesField: 'typing_totalGames',
        minGames: 3,
        page,
        limit,
      });
      const data = {
        entries: mapEntries(result.entries, (page - 1) * limit, 'typing_bestWpm', [
          'typing_totalGames',
          'typing_weightedAccuracy',
          'typing_multiWins',
          'typing_totalCharsTyped',
        ]),
        total: result.total,
        page,
      };
      cacheSet(cacheKey, data);
      res.json({ data });
    }),
  );

  router.get(
    '/typing/accuracy',
    asyncHandler(async (req, res) => {
      const { page, limit } = pageQuerySchema.parse(req.query);
      const cacheKey = `typing_acc:${page}:${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      const result = await userStatsRepository.leaderboard({
        sortField: 'typing_weightedAccuracy',
        minGamesField: 'typing_totalGames',
        minGames: 3,
        page,
        limit,
      });
      const data = {
        entries: mapEntries(result.entries, (page - 1) * limit, 'typing_weightedAccuracy', [
          'typing_totalGames',
          'typing_bestWpm',
          'typing_totalCharsTyped',
          'typing_multiWins',
        ]),
        total: result.total,
        page,
      };
      cacheSet(cacheKey, data);
      res.json({ data });
    }),
  );

  router.get(
    '/npat',
    asyncHandler(async (req, res) => {
      const { page, limit } = pageQuerySchema.parse(req.query);
      const cacheKey = `npat:${page}:${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      const result = await userStatsRepository.leaderboard({
        sortField: 'npat_averageScore',
        minGamesField: 'npat_totalGames',
        minGames: 2,
        page,
        limit,
      });
      const data = {
        entries: mapEntries(result.entries, (page - 1) * limit, 'npat_averageScore', [
          'npat_totalGames',
          'npat_winRate',
          'npat_wins',
          'npat_totalScore',
        ]),
        total: result.total,
        page,
      };
      cacheSet(cacheKey, data);
      res.json({ data });
    }),
  );

  router.get(
    '/global',
    asyncHandler(async (req, res) => {
      const { page, limit } = pageQuerySchema.parse(req.query);
      const cacheKey = `global:${page}:${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      const result = await userStatsRepository.leaderboard({
        sortField: 'global_score',
        minGamesField: 'typing_totalGames',
        minGames: 0,
        page,
        limit,
      });
      const skip = (page - 1) * limit;
      const entries = result.entries
        .filter((e) => (e.typing_totalGames ?? 0) + (e.npat_totalGames ?? 0) + (e.taboo_gamesPlayed ?? 0) >= 5)
        .map((e, i) => ({
          rank: e.global_rank ?? skip + i + 1,
          userId: String(e.userId),
          username: e.username,
          avatarUrl: avatarUrl(e.username),
          globalScore: e.global_score,
          typing_bestWpm: e.typing_bestWpm ?? 0,
          typing_weightedAccuracy: e.typing_weightedAccuracy ?? 0,
          npat_averageScore: e.npat_averageScore ?? 0,
          npat_winRate: e.npat_winRate ?? 0,
          taboo_score: e.taboo_score ?? 0,
          taboo_winRate: e.taboo_winRate ?? 0,
          taboo_guessAccuracy: e.taboo_guessAccuracy ?? 0,
          taboo_speakerSuccessRate: e.taboo_speakerSuccessRate ?? 0,
          taboo_gamesPlayed: e.taboo_gamesPlayed ?? 0,
          activeDaysLast30: e.activeDaysLast30 ?? 0,
          typing_totalGames: e.typing_totalGames ?? 0,
          npat_totalGames: e.npat_totalGames ?? 0,
          totalGames: (e.typing_totalGames ?? 0) + (e.npat_totalGames ?? 0) + (e.taboo_gamesPlayed ?? 0),
          breakdown: {
            typing: Math.round(Math.min(e.typing_bestWpm / 150, 1) * 100 * 100) / 100,
            accuracy: Math.round((e.typing_weightedAccuracy ?? 0) * 100) / 100,
            npat: Math.round(Math.min((e.npat_averageScore ?? 0) / 35, 1) * 100 * 100) / 100,
            taboo: Math.round(e.taboo_score ?? 0),
            activity: Math.round(Math.min(((e.typing_totalGames ?? 0) + (e.npat_totalGames ?? 0) + (e.taboo_gamesPlayed ?? 0)) / 100, 1) * 100 * 100) / 100,
            consistency: Math.round(Math.min((e.activeDaysLast30 ?? 0) / 20, 1) * 100 * 100) / 100,
          },
        }));
      const data = { entries, total: entries.length, page };
      cacheSet(cacheKey, data);
      res.json({ data });
    }),
  );

  router.get(
    '/taboo',
    asyncHandler(async (req, res) => {
      const { page, limit } = pageQuerySchema.parse(req.query);
      const cacheKey = `taboo:${page}:${limit}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.json({ data: cached });

      const result = await userStatsRepository.leaderboard({
        sortField: 'taboo_score',
        minGamesField: 'taboo_gamesPlayed',
        minGames: 3,
        page,
        limit,
      });
      const data = {
        entries: mapEntries(result.entries, (page - 1) * limit, 'taboo_score', [
          'taboo_gamesPlayed',
          'taboo_gamesWon',
          'taboo_winRate',
          'taboo_guessAccuracy',
          'taboo_speakerSuccessRate',
          'taboo_tabooViolations',
        ]),
        total: result.total,
        page,
      };
      cacheSet(cacheKey, data);
      res.json({ data });
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const stats = await userStatsRepository.findByUserId(userId);
      if (!stats) {
        return res.json({
          data: {
            typing: { bestWpm: 0, weightedAccuracy: 0, totalGames: 0, wpmRank: null, accuracyRank: null },
            npat: { averageScore: 0, totalGames: 0, winRate: 0, npatRank: null },
            taboo: {
              score: 0,
              gamesPlayed: 0,
              gamesWon: 0,
              winRate: 0,
              guessAccuracy: 0,
              speakerSuccessRate: 0,
              speakerRounds: 0,
              correctGuessesAsSpeaker: 0,
              tabooViolations: 0,
              tabooRank: null,
              breakdown: { speakerSkill: 0, guessSkill: 0, winRate: 0, score: 0 },
            },
            global: { score: 0, rank: null, breakdown: { typing: 0, accuracy: 0, npat: 0, taboo: 0, activity: 0, consistency: 0 } },
          },
        });
      }

      const [wpmRank, accRank, npatRank, tabooRank] = await Promise.all([
        userStatsRepository.rankFor({ userId, sortField: 'typing_bestWpm', minGamesField: 'typing_totalGames', minGames: 3 }),
        userStatsRepository.rankFor({ userId, sortField: 'typing_weightedAccuracy', minGamesField: 'typing_totalGames', minGames: 3 }),
        userStatsRepository.rankFor({ userId, sortField: 'npat_averageScore', minGamesField: 'npat_totalGames', minGames: 2 }),
        userStatsRepository.rankFor({ userId, sortField: 'taboo_score', minGamesField: 'taboo_gamesPlayed', minGames: 3 }),
      ]);

      const totalGames = (stats.typing_totalGames ?? 0) + (stats.npat_totalGames ?? 0) + (stats.taboo_gamesPlayed ?? 0);
      res.json({
        data: {
          typing: {
            bestWpm: stats.typing_bestWpm ?? 0,
            weightedAccuracy: stats.typing_weightedAccuracy ?? 0,
            totalGames: stats.typing_totalGames ?? 0,
            multiWins: stats.typing_multiWins ?? 0,
            wpmRank,
            accuracyRank: accRank,
          },
          npat: {
            averageScore: stats.npat_averageScore ?? 0,
            totalGames: stats.npat_totalGames ?? 0,
            winRate: stats.npat_winRate ?? 0,
            wins: stats.npat_wins ?? 0,
            npatRank,
          },
          taboo: {
            score: stats.taboo_score ?? 0,
            gamesPlayed: stats.taboo_gamesPlayed ?? 0,
            gamesWon: stats.taboo_gamesWon ?? 0,
            winRate: stats.taboo_winRate ?? 0,
            guessAccuracy: stats.taboo_guessAccuracy ?? 0,
            speakerSuccessRate: stats.taboo_speakerSuccessRate ?? 0,
            speakerRounds: stats.taboo_speakerRounds ?? 0,
            correctGuessesAsSpeaker: stats.taboo_correctGuessesAsSpeaker ?? 0,
            tabooViolations: stats.taboo_tabooViolations ?? 0,
            tabooRank,
            breakdown: {
              speakerSkill: Math.round((stats.taboo_speakerSuccessRate ?? 0) * 100) / 100,
              guessSkill: Math.round((stats.taboo_guessAccuracy ?? 0) * 100) / 100,
              winRate: Math.round((stats.taboo_winRate ?? 0) * 100) / 100,
              score: Math.round((stats.taboo_score ?? 0) * 100) / 100,
            },
          },
          global: {
            score: stats.global_score ?? 0,
            rank: stats.global_rank ?? null,
            totalGames,
            breakdown: {
              typing: Math.round(Math.min((stats.typing_bestWpm ?? 0) / 150, 1) * 100 * 100) / 100,
              accuracy: Math.round((stats.typing_weightedAccuracy ?? 0) * 100) / 100,
              npat: Math.round(Math.min((stats.npat_averageScore ?? 0) / 35, 1) * 100 * 100) / 100,
              taboo: Math.round(stats.taboo_score ?? 0),
              activity: Math.round(Math.min(totalGames / 100, 1) * 100 * 100) / 100,
              consistency: Math.round(Math.min((stats.activeDaysLast30 ?? 0) / 20, 1) * 100 * 100) / 100,
            },
          },
        },
      });
    }),
  );

  router.post(
    '/typing/solo',
    requireAuth,
    validateBody(soloTypingSchema),
    asyncHandler(async (req, res) => {
      const { id: userId, username } = req.user;
      const data = req.body;
      void persistTypingAttempt({
        userId,
        username,
        mode: 'solo',
        passageLength: data.passageLength,
        correctChars: data.correctChars,
        incorrectChars: data.incorrectChars,
        extraChars: data.extraChars,
        wpm: data.wpm,
        rawWpm: data.rawWpm,
        elapsedMs: data.elapsedMs,
      }, req.log);
      res.status(201).json({ data: { ok: true } });
    }),
  );

  return router;
}
