import mongoose from 'mongoose';
import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';
import { tabooResultRepository } from '../repositories/tabooResultRepository.js';
import { cahLeaderboardLedgerRepository } from '../repositories/cahLeaderboardLedgerRepository.js';
import { hangmanGameResultRepository } from '../repositories/hangmanGameResultRepository.js';
import { userStatsRepository } from '../repositories/userStatsRepository.js';

/**
 * Daily leaderboard maintenance:
 * 1. Recompute activeDaysLast30 for every user with stats.
 * 2. Recompute global_rank for all qualifying users.
 *
 * @param {import('pino').Logger} logger
 */
export async function runLeaderboardDailyCron(logger) {
  const start = Date.now();
  logger.info({ event: 'leaderboard_cron_start' }, 'leaderboard_cron');

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userIds = await userStatsRepository.allUserIds();

    let updated = 0;
    for (const uid of userIds) {
      try {
        const oid = uid instanceof mongoose.Types.ObjectId ? uid : new mongoose.Types.ObjectId(String(uid));
        const [typingDayKeys, npatDayKeys, tabooDayKeys, cahDayKeys, hangmanDayKeys, hangmanGamesLast30] = await Promise.all([
          typingAttemptRepository.activeDayKeysSince(oid, since),
          npatResultRepository.activeDayKeysSince(oid, since),
          tabooResultRepository.activeDayKeysSince(oid, since),
          cahLeaderboardLedgerRepository.activeDayKeysSince(oid, since),
          hangmanGameResultRepository.activeDayKeysSince(oid, since),
          hangmanGameResultRepository.gamesPlayedSince(oid, since),
        ]);
        const unionDays = new Set([...typingDayKeys, ...npatDayKeys, ...tabooDayKeys, ...cahDayKeys, ...hangmanDayKeys]);
        const totalDays = Math.min(unionDays.size, 30);
        await userStatsRepository.updateActiveDaysAndGlobalScore(
          oid,
          totalDays,
          tabooDayKeys.length,
          Math.min(hangmanDayKeys.length, 30),
          hangmanGamesLast30,
        );
        updated += 1;
      } catch (err) {
        logger.warn({ err, userId: String(uid), event: 'leaderboard_cron_user_error' }, 'leaderboard_cron');
      }
    }

    await userStatsRepository.recomputeGlobalRanks();
    await userStatsRepository.recomputeHangmanRanks();

    const elapsed = Date.now() - start;
    logger.info({ event: 'leaderboard_cron_done', updated, elapsed }, 'leaderboard_cron');
  } catch (err) {
    logger.error({ err, event: 'leaderboard_cron_failed' }, 'leaderboard_cron');
  }
}

const DAILY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule the daily cron. Runs once immediately (after Mongo connected), then every 24h.
 * @param {import('pino').Logger} logger
 */
export function scheduleLeaderboardCron(logger) {
  const run = () => {
    if (mongoose.connection.readyState !== 1) return;
    void runLeaderboardDailyCron(logger);
  };

  if (mongoose.connection.readyState === 1) {
    setTimeout(run, 5000);
  } else {
    mongoose.connection.once('connected', () => setTimeout(run, 5000));
  }

  const interval = setInterval(run, DAILY_MS);
  interval.unref();
  return interval;
}
