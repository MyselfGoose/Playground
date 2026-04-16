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
   * Lean existence check for a session that is still valid (not revoked, not rotated, not expired).
   * Used by `requireAuth` to tie access tokens to a live refresh session.
   * @param {string} jti
   */
  isJtiActive(jti) {
    return RefreshSession.exists({
      jti,
      revokedAt: null,
      replacedByJti: null,
      expiresAt: { $gt: new Date() },
    });
  },

  /**
   * Atomically rotate a refresh session. Marks the old session `revokedAt + replacedByJti`
   * only if it is currently active (not revoked, not already replaced, not expired).
   *
   * @param {string} oldJti
   * @param {string} newJti
   * @returns {Promise<{ userId: unknown } | null>} the old session row (with `userId`) if rotation won; `null` if the session is missing or was already rotated/revoked.
   */
  async atomicRotate(oldJti, newJti) {
    const now = new Date();
    const updated = await RefreshSession.findOneAndUpdate(
      {
        jti: oldJti,
        revokedAt: null,
        replacedByJti: null,
        expiresAt: { $gt: now },
      },
      { $set: { revokedAt: now, replacedByJti: newJti } },
      { new: false },
    ).lean();
    return updated ?? null;
  },

  /**
   * @param {string} jti
   */
  revokeByJti(jti) {
    return RefreshSession.updateOne(
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
