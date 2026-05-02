import { TypingAttempt } from '../models/TypingAttempt.js';

export const typingAttemptRepository = {
  /**
   * @param {Record<string, unknown>} doc
   */
  async create(doc) {
    return TypingAttempt.create(doc);
  },

  /**
   * @param {string} userId
   * @param {{ limit?: number, skip?: number }} [opts]
   */
  findByUser(userId, { limit = 25, skip = 0 } = {}) {
    return TypingAttempt.find({ userId })
      .sort({ finishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  },

  /**
   * Distinct dates with at least one attempt in the given range.
   * @param {string} userId
   * @param {Date} since
   */
  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {Date} since
   */
  async activeDayKeysSince(userOid, since) {
    const results = await TypingAttempt.aggregate([
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
