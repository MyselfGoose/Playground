import { OAuthCompletionTicket } from '../models/OAuthCompletionTicket.js';

export const oauthCompletionTicketRepository = {
  /**
   * @param {{ jti: string, userId: import('mongoose').Types.ObjectId | string, expiresAt: Date }} doc
   */
  async create(doc) {
    await OAuthCompletionTicket.create(doc);
  },

  /**
   * Atomically mark ticket consumed; returns userId if valid and unused.
   * @param {string} jti
   */
  async consume(jti) {
    const now = new Date();
    const row = await OAuthCompletionTicket.findOneAndUpdate(
      {
        jti,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { new: false },
    ).lean();
    return row?.userId ? String(row.userId) : null;
  },
};
