import mongoose from 'mongoose';
import { CahRoundLedger } from '../models/CahRoundLedger.js';
import { CahGameLedger } from '../models/CahGameLedger.js';
import { CahActivityEvent } from '../models/CahActivityEvent.js';

function isDuplicateKey(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

export const cahLeaderboardLedgerRepository = {
  /**
   * @returns {Promise<boolean>} true if this round was newly recorded (not duplicate).
   */
  async tryInsertRoundLedger({ gameSessionId, roundIndex, roomCode }) {
    try {
      await CahRoundLedger.create({
        gameSessionId,
        roundIndex,
        roomCode: roomCode ?? '',
        occurredAt: new Date(),
      });
      return true;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  },

  /**
   * @returns {Promise<boolean>} true if this game completion was newly recorded.
   */
  async tryInsertGameLedger({ gameSessionId }) {
    try {
      await CahGameLedger.create({
        gameSessionId,
        occurredAt: new Date(),
      });
      return true;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  },

  /**
   * @param {string[]} userIds
   */
  async insertActivityForUsers(userIds, occurredAt = new Date()) {
    const docs = [];
    const seen = new Set();
    for (const id of userIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) continue;
      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push({ userId: new mongoose.Types.ObjectId(id), occurredAt });
    }
    if (!docs.length) return;
    await CahActivityEvent.insertMany(docs, { ordered: false });
  },

  /**
   * Distinct calendar days with CAH activity in the window (matches Taboo pattern).
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async activeDaysSince(userOid, since) {
    const results = await CahActivityEvent.aggregate([
      { $match: { userId: userOid, occurredAt: { $gte: since } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } } } },
      { $group: { _id: '$day' } },
    ]);
    return results.length;
  },
};
