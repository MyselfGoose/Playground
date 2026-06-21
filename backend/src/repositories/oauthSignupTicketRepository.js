import { OAuthSignupTicket } from '../models/OAuthSignupTicket.js';

/**
 * @typedef {{
 *   googleId: string,
 *   email: string,
 *   name: string,
 *   picture: string | null,
 * }} OAuthSignupProfile
 */

export const oauthSignupTicketRepository = {
  /**
   * @param {{
   *   jti: string,
   *   googleId: string,
   *   email: string,
   *   name: string,
   *   picture?: string | null,
   *   expiresAt: Date,
   * }} doc
   */
  async create(doc) {
    await OAuthSignupTicket.create(doc);
  },

  /**
   * Atomically consume signup ticket; returns profile snapshot if valid.
   * @param {string} jti
   * @returns {Promise<OAuthSignupProfile | null>}
   */
  /**
   * Read signup ticket without consuming (for username setup UI).
   * @param {string} jti
   * @returns {Promise<OAuthSignupProfile | null>}
   */
  async peek(jti) {
    const now = new Date();
    const row = await OAuthSignupTicket.findOne({
      jti,
      consumedAt: null,
      expiresAt: { $gt: now },
    }).lean();
    if (!row) return null;
    return {
      googleId: row.googleId,
      email: row.email,
      name: row.name,
      picture: row.picture ?? null,
    };
  },

  async consume(jti) {
    const now = new Date();
    const row = await OAuthSignupTicket.findOneAndUpdate(
      {
        jti,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { new: false },
    ).lean();
    if (!row) return null;
    return {
      googleId: row.googleId,
      email: row.email,
      name: row.name,
      picture: row.picture ?? null,
    };
  },

  async countPending() {
    const now = new Date();
    return OAuthSignupTicket.countDocuments({ consumedAt: null, expiresAt: { $gt: now } });
  },

  /**
   * @param {number} limit
   */
  listPending(limit = 50) {
    const now = new Date();
    return OAuthSignupTicket.find({ consumedAt: null, expiresAt: { $gt: now } })
      .sort({ expiresAt: 1 })
      .limit(limit)
      .lean();
  },

  deleteExpired() {
    const now = new Date();
    return OAuthSignupTicket.deleteMany({
      $or: [{ expiresAt: { $lte: now } }, { consumedAt: { $ne: null } }],
    });
  },
};
