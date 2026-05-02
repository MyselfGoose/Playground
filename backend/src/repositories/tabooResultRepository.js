import { TabooResult } from '../models/TabooResult.js';

export const tabooResultRepository = {
  /**
   * @param {Array<Record<string, unknown>>} docs
   */
  async insertMany(docs) {
    return TabooResult.insertMany(docs, { ordered: false });
  },

  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async activeDayKeysSince(userOid, since) {
    const results = await TabooResult.aggregate([
      { $match: { userId: userOid, finishedAt: { $gte: since } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$finishedAt' } } } },
      { $group: { _id: '$day' } },
    ]);
    return results.map((r) => String(r._id));
  },

  async activeDaysSince(userOid, since) {
    const days = await this.activeDayKeysSince(userOid, since);
    return days.length;
  },
};
