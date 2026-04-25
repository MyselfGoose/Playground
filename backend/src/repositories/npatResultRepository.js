import { NpatResult } from '../models/NpatResult.js';

export const npatResultRepository = {
  /**
   * @param {Array<Record<string, unknown>>} docs
   */
  async insertMany(docs) {
    return NpatResult.insertMany(docs, { ordered: false });
  },

  /**
   * @param {string} userId
   * @param {{ limit?: number, skip?: number }} [opts]
   */
  findByUser(userId, { limit = 25, skip = 0 } = {}) {
    return NpatResult.find({ userId })
      .sort({ finishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async activeDaysSince(userOid, since) {
    const results = await NpatResult.aggregate([
      { $match: { userId: userOid, finishedAt: { $gte: since } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$finishedAt' } } } },
      { $group: { _id: '$day' } },
    ]);
    return results.length;
  },
};
