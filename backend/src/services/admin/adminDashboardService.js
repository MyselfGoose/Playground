import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { userRepository } from '../../repositories/userRepository.js';
import { typingAttemptRepository } from '../../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../../repositories/npatResultRepository.js';
import { tabooResultRepository } from '../../repositories/tabooResultRepository.js';
import { hangmanGameResultRepository } from '../../repositories/hangmanGameResultRepository.js';
import { cahLeaderboardLedgerRepository } from '../../repositories/cahLeaderboardLedgerRepository.js';
import { getAggregatedHealth, getAiHealth, getNpatEvaluationStats } from '../../observability/serviceHealth.js';
import { getPlatformMetrics } from '../../observability/platformMetrics.js';
import { isProcessDegraded, getLastUnhandledAt } from '../../processHandlers.js';
import { getLeaderboardCronStatus } from '../../jobs/leaderboardCron.js';
import { getLiveActivitySnapshot } from './adminLiveActivityService.js';
import { getAdminRuntimeContext } from './adminRuntimeContext.js';
import { listAllRoomsForAdmin } from './adminRuntimeHub.js';
import { getMaintenanceCached, getPlatformSettingsCached } from '../platformSettingsService.js';
import { adminAuditService } from './adminAuditService.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

/** @type {{ data: unknown, expiresAt: number } | null} */
let dashboardCache = null;
const DASHBOARD_CACHE_MS = 15_000;

function dayStartAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * @param {import('../../config/env.js').Env} env
 */
export function createAdminDashboardService(env) {
  return {
    async getDashboard() {
      const now = Date.now();
      if (dashboardCache && dashboardCache.expiresAt > now) {
        return dashboardCache.data;
      }

      const today = dayStartAgo(0);
      const week = dayStartAgo(7);
      const month = dayStartAgo(30);

      const [
        totalUsers,
        signupsToday,
        signups7d,
        signups30d,
        active7d,
        gamesToday,
        games7d,
        gamesAllTime,
        recentSignups,
        recentAudit,
      ] = await Promise.all([
        userRepository.countUsers(),
        userRepository.countSignupsSince(today),
        userRepository.countSignupsSince(week),
        userRepository.countSignupsSince(month),
        userRepository.countActiveSince(week),
        countAllGamesSince(today),
        countAllGamesSince(week),
        countAllGamesSince(new Date(0)),
        userRepository.listRecentSignups(10),
        adminAuditService.listRecent({ limit: 10 }),
      ]);

      const popularity = await getGamePopularity(today, week);
      const health = buildHealth(env);
      const liveActivity = getLiveActivitySnapshot();
      const runtime = getAdminRuntimeContext();
      const maintenance = getMaintenanceCached();
      const platformSettings = getPlatformSettingsCached();

      const bootedAtMs = new Date(runtime.bootedAt).getTime();
      const roomRows = listAllRoomsForAdmin();
      const survivedRestart = roomRows.some((r) => {
        const created = r.createdAt ? Number(r.createdAt) : 0;
        return created > 0 && created < bootedAtMs;
      });
      const alerts = buildAlerts(signupsToday, health, { survivedRestart });

      const payload = {
        snapshot: {
          totalUsers,
          signupsToday,
          signups7d,
          signups30d,
          activeUsers7d: active7d,
          gamesPlayedToday: gamesToday,
        },
        liveActivity: {
          byGame: liveActivity,
          totalRooms: liveActivity.reduce((s, g) => s + g.rooms, 0),
          totalPlayers: liveActivity.reduce((s, g) => s + g.players, 0),
          perInstance: true,
          instanceCount: runtime.instanceCount,
        },
        gamePopularity: popularity,
        health,
        alerts,
        maintenance,
        platformSettings,
        recentSignups: recentSignups.map((u) => ({
          id: String(u._id),
          username: u.username,
          email: u.email,
          authProviders: u.authProviders ?? ['local'],
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
        recentAudit: recentAudit.map((a) => ({
          id: String(a._id),
          action: a.action,
          actorId: String(a.actorId),
          targetUserId: a.targetUserId ? String(a.targetUserId) : null,
          reason: a.reason,
          createdAt: a.createdAt,
        })),
        deployment: {
          version,
          uptime: process.uptime(),
          instanceCount: runtime.instanceCount,
          bootedAt: runtime.bootedAt,
          bootId: runtime.bootId,
          nodeEnv: env.NODE_ENV,
          gamesPlayed7d: games7d,
          gamesAllTime,
        },
      };

      dashboardCache = { data: payload, expiresAt: now + DASHBOARD_CACHE_MS };
      return payload;
    },
  };
}

/**
 * @param {Date} since
 */
async function countAllGamesSince(since) {
  const [typing, npat, taboo, hangman, cah] = await Promise.all([
    typingAttemptRepository.countSince(since),
    npatResultRepository.countSince(since),
    tabooResultRepository.countSince(since),
    hangmanGameResultRepository.countSince(since),
    cahLeaderboardLedgerRepository.countSince(since),
  ]);
  return typing + npat + taboo + hangman + cah;
}

/**
 * @param {Date} today
 * @param {Date} week
 */
async function getGamePopularity(today, week) {
  const games = [
    { key: 'typing-race', repo: typingAttemptRepository },
    { key: 'npat', repo: npatResultRepository },
    { key: 'taboo', repo: tabooResultRepository },
    { key: 'hangman', repo: hangmanGameResultRepository },
    { key: 'cah', repo: cahLeaderboardLedgerRepository },
  ];

  const results = await Promise.all(
    games.map(async (g) => ({
      game: g.key,
      today: await g.repo.countSince(today),
      week: await g.repo.countSince(week),
      allTime: await g.repo.countSince(new Date(0)),
    })),
  );

  return results;
}

/**
 * @param {import('../../config/env.js').Env} env
 */
function buildHealth(env) {
  const aggregated = getAggregatedHealth(env);
  const runtime = getAdminRuntimeContext();
  const metrics = getPlatformMetrics();
  const cron = getLeaderboardCronStatus();

  return {
    status: aggregated.status,
    processDegraded: isProcessDegraded(),
    lastUnhandledAt: getLastUnhandledAt() || null,
    services: {
      mongodb: mongoose.connection.readyState === 1,
      auth: aggregated.services.auth,
      gemini: aggregated.services.ai,
      redis: runtime.redisConnected,
    },
    ai: getAiHealth(),
    npatEvaluation: getNpatEvaluationStats(),
    cron: {
      lastRunAt: cron.at,
      status: cron.status,
      elapsedMs: cron.elapsedMs,
    },
    metrics: metrics.counters,
  };
}

/**
 * @param {number} signupsToday
 * @param {Record<string, unknown>} health
 * @param {{ survivedRestart?: boolean }} [opts]
 */
function buildAlerts(signupsToday, health, opts = {}) {
  /** @type {Array<{ level: string, code: string, message: string }>} */
  const alerts = [];

  const npatEval = health.npatEvaluation;
  if (npatEval && typeof npatEval === 'object' && 'alerts' in npatEval) {
    const npatAlerts = npatEval.alerts;
    if (npatAlerts?.fallbackRateHigh) {
      alerts.push({
        level: 'warning',
        code: 'NPAT_FALLBACK_RATE_HIGH',
        message: 'NPAT evaluation fallback rate is elevated',
      });
    }
    if (npatAlerts?.repeatedAuthOrQuotaFailures) {
      alerts.push({
        level: 'critical',
        code: 'NPAT_GEMINI_AUTH_QUOTA',
        message: 'Repeated Gemini auth/quota failures detected',
      });
    }
  }

  if (health.processDegraded) {
    alerts.push({
      level: 'critical',
      code: 'PROCESS_DEGRADED',
      message: 'Process has unhandled rejections',
    });
  }

  if (signupsToday >= 50) {
    alerts.push({
      level: 'info',
      code: 'SIGNUP_SPIKE',
      message: `${signupsToday} signups today — review for abuse`,
    });
  }

  const metrics = health.metrics;
  if (metrics && typeof metrics === 'object' && 'unhandled_rejection' in metrics) {
    const count = Number(metrics.unhandled_rejection);
    if (count > 0) {
      alerts.push({
        level: 'warning',
        code: 'UNHANDLED_REJECTIONS',
        message: `${count} unhandled rejections recorded`,
      });
    }
  }

  if (opts.survivedRestart) {
    alerts.push({
      level: 'warning',
      code: 'ROOMS_SURVIVED_RESTART',
      message: 'Active rooms detected that predate this server boot (possible hydration or multi-instance)',
    });
  }

  return alerts;
}

export function clearDashboardCache() {
  dashboardCache = null;
}
