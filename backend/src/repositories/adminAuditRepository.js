import { AdminAuditLog } from '../models/AdminAuditLog.js';

export const adminAuditRepository = {
  /**
   * @param {{
   *   actorId: string,
   *   targetUserId?: string | null,
   *   action: string,
   *   reason?: string,
   *   metadata?: Record<string, unknown> | null,
   * }} entry
   */
  async create(entry) {
    return AdminAuditLog.create({
      actorId: entry.actorId,
      targetUserId: entry.targetUserId ?? null,
      action: entry.action,
      reason: entry.reason ?? '',
      metadata: entry.metadata ?? null,
    });
  },

  /**
   * @param {string} targetUserId
   * @param {{ limit?: number, skip?: number }} [opts]
   */
  findByTargetUser(targetUserId, { limit = 50, skip = 0 } = {}) {
    const capped = Math.max(1, Math.min(100, limit));
    return AdminAuditLog.find({ targetUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(capped)
      .lean();
  },

  /**
   * @param {{ limit?: number }} [opts]
   */
  findRecent({ limit = 20 } = {}) {
    const capped = Math.max(1, Math.min(50, limit));
    return AdminAuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(capped)
      .lean();
  },
};
