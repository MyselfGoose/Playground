import { HangmanGameResult } from '../models/HangmanGameResult.js';

export const hangmanGameResultRepository = {
  /**
   * @param {Record<string, unknown>} doc
   */
  async insertOne(doc) {
    return HangmanGameResult.create(doc);
  },

  /**
   * @param {Array<Record<string, unknown>>} docs
   */
  async insertMany(docs) {
    return HangmanGameResult.insertMany(docs, { ordered: false });
  },

  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async activeDayKeysSince(userOid, since) {
    const results = await HangmanGameResult.aggregate([
      { $match: { userId: userOid, finishedAt: { $gte: since } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$finishedAt' } } } },
      { $group: { _id: '$day' } },
    ]);
    return results.map((r) => String(r._id));
  },

  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async gamesPlayedSince(userOid, since) {
    return HangmanGameResult.countDocuments({ userId: userOid, finishedAt: { $gte: since } });
  },
};
