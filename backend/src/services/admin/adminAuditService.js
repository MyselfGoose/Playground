import { adminAuditRepository } from '../../repositories/adminAuditRepository.js';

export const adminAuditService = {
  /**
   * @param {{
   *   actorId: string,
   *   targetUserId?: string | null,
   *   action: string,
   *   reason?: string,
   *   metadata?: Record<string, unknown> | null,
   * }} entry
   */
  async log(entry) {
    const created = await adminAuditRepository.create(entry);
    return created;
  },

  /**
   * @param {string} targetUserId
   * @param {{ limit?: number, skip?: number }} [opts]
   */
  listForUser(targetUserId, opts) {
    return adminAuditRepository.findByTargetUser(targetUserId, opts);
  },

  listRecent(opts) {
    return adminAuditRepository.findRecent(opts);
  },
};
