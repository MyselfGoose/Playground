import { RefreshSession } from '../models/RefreshSession.js';

export const refreshSessionRepository = {
  /**
   * @param {{
   *   userId: import('mongoose').Types.ObjectId | string,
   *   jti: string,
   *   expiresAt: Date,
   *   userAgent?: string,
   *   createdFromIp?: string,
   * }} params
   */
  createSession({ userId, jti, expiresAt, userAgent, createdFromIp }) {
    return RefreshSession.create({
      userId,
      jti,
      expiresAt,
      userAgent,
      createdFromIp,
    });
  },

  /**
   * @param {string} jti
   */
  findByJti(jti) {
    return RefreshSession.findOne({ jti }).lean();
  },

  /**
   * @param {string} jti
   */
  findActiveByJti(jti) {
    return RefreshSession.findOne({
      jti,
      revokedAt: null,
      replacedByJti: null,
      expiresAt: { $gt: new Date() },
    }).lean();
  },

  /**
   * @param {string} oldJti
   * @param {string} newJti
   */
  markSessionRotated(oldJti, newJti) {
    return RefreshSession.updateOne(
      { jti: oldJti },
      { $set: { replacedByJti: newJti, revokedAt: new Date() } },
    );
  },

  /**
   * @param {string} jti
   */
  revokeByJti(jti) {
    return RefreshSession.updateMany(
      { jti, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  },

  /**
   * @param {import('mongoose').Types.ObjectId | string} userId
   */
  revokeAllForUser(userId) {
    return RefreshSession.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  },
};
