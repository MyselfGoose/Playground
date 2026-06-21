import mongoose from 'mongoose';
import { AppError } from '../../errors/AppError.js';
import { UserStats } from '../../models/UserStats.js';
import {
  computeGlobalScore,
  computeTabooDerived,
  computeCahDerived,
  computeHangmanDerived,
} from '../../repositories/userStatsRepository.js';
import { userStatsRepository } from '../../repositories/userStatsRepository.js';

const EDITABLE_STAT_FIELDS = new Set([
  'typing_totalGames',
  'typing_bestWpm',
  'typing_bestAccuracy',
  'typing_weightedAccuracy',
  'typing_multiWins',
  'npat_totalGames',
  'npat_totalScore',
  'npat_averageScore',
  'npat_wins',
  'taboo_gamesPlayed',
  'taboo_gamesWon',
  'taboo_score',
  'cah_gamesPlayed',
  'cah_roundsPlayed',
  'cah_roundWins',
  'cah_score',
  'hangman_totalGames',
  'hangman_totalWins',
  'hangman_skill',
  'global_score',
]);

export const adminStatsService = {
  /**
   * @param {string} userId
   */
  async getStats(userId) {
    const stats = await userStatsRepository.findByUserId(userId);
    return stats ?? null;
  },

  /**
   * @param {string} userId
   * @param {Record<string, number>} patch
   */
  async patchStats(userId, patch) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError(400, 'Invalid user id', { code: 'VALIDATION_ERROR', expose: true });
    }

    const keys = Object.keys(patch);
    if (keys.length === 0) {
      throw new AppError(400, 'No fields to update', { code: 'VALIDATION_ERROR', expose: true });
    }

    for (const key of keys) {
      if (!EDITABLE_STAT_FIELDS.has(key)) {
        throw new AppError(400, `Field not editable: ${key}`, { code: 'VALIDATION_ERROR', expose: true });
      }
      const val = patch[key];
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        throw new AppError(400, `Invalid value for ${key}`, { code: 'VALIDATION_ERROR', expose: true });
      }
    }

    const oid = new mongoose.Types.ObjectId(userId);
    let doc = await UserStats.findOneAndUpdate(
      { userId: oid },
      { $set: patch },
      { new: true, lean: true },
    );

    if (!doc) {
      throw new AppError(404, 'Stats not found', { code: 'STATS_NOT_FOUND', expose: true });
    }

    const tabooDerived = computeTabooDerived(doc);
    const cahDerived = computeCahDerived(doc);
    const hangmanDerived = computeHangmanDerived(doc);
    const globalScore = Math.round(
      computeGlobalScore({ ...doc, ...tabooDerived, ...cahDerived, ...hangmanDerived }) * 100,
    ) / 100;

    doc = await UserStats.findOneAndUpdate(
      { userId: oid },
      { $set: { ...tabooDerived, ...cahDerived, ...hangmanDerived, global_score: globalScore } },
      { new: true, lean: true },
    );

    await userStatsRepository.recomputeGlobalRanks();
    await userStatsRepository.recomputeHangmanRanks();

    return doc;
  },
};
