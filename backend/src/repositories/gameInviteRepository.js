import mongoose from 'mongoose';
import { GameInvite } from '../models/GameInvite.js';

/**
 * @param {unknown} id
 * @returns {import('mongoose').Types.ObjectId}
 */
function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

/**
 * @param {Record<string, unknown>} doc
 */
function mapInvite(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    inviterId: String(doc.inviterId),
    recipientId: String(doc.recipientId),
    gameSlug: doc.gameSlug,
    roomCode: doc.roomCode,
    status: doc.status,
    readAt: doc.readAt ?? null,
    expiresAt: doc.expiresAt,
    respondedAt: doc.respondedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const gameInviteRepository = {
  /**
   * @param {object} data
   */
  async create(data) {
    const doc = await GameInvite.create(data);
    return mapInvite(doc.toObject());
  },

  /**
   * @param {string} id
   */
  async findById(id) {
    const doc = await GameInvite.findById(toObjectId(id)).lean();
    return mapInvite(doc);
  },

  /**
   * @param {string} recipientId
   * @param {Date} since
   */
  async listForRecipient(recipientId, since) {
    const rows = await GameInvite.find({
      recipientId: toObjectId(recipientId),
      $or: [
        { status: 'pending' },
        { status: { $in: ['accepted', 'declined', 'cancelled', 'expired'] }, updatedAt: { $gte: since } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return rows.map(mapInvite);
  },

  /**
   * @param {string} recipientId
   */
  async countUnread(recipientId) {
    return GameInvite.countDocuments({
      recipientId: toObjectId(recipientId),
      status: 'pending',
      readAt: null,
      expiresAt: { $gt: new Date() },
    });
  },

  /**
   * @param {string} recipientId
   * @param {string[]} [inviteIds]
   */
  async markRead(recipientId, inviteIds) {
    const filter = {
      recipientId: toObjectId(recipientId),
      readAt: null,
    };
    if (inviteIds?.length) {
      filter._id = { $in: inviteIds.map(toObjectId) };
    }
    const result = await GameInvite.updateMany(filter, { $set: { readAt: new Date() } });
    return result.modifiedCount;
  },

  /**
   * @param {string} id
   * @param {string} fromStatus
   * @param {object} update
   */
  async transitionStatus(id, fromStatus, update) {
    const doc = await GameInvite.findOneAndUpdate(
      { _id: toObjectId(id), status: fromStatus },
      { $set: update },
      { new: true },
    ).lean();
    return mapInvite(doc);
  },

  /**
   * @param {string} gameSlug
   * @param {string} roomCode
   */
  async listPendingForRoom(gameSlug, roomCode) {
    const rows = await GameInvite.find({
      gameSlug,
      roomCode,
      status: 'pending',
    }).lean();
    return rows.map(mapInvite);
  },

  /**
   * @param {string} gameSlug
   * @param {string} roomCode
   * @param {string} status
   * @param {object} [extra]
   */
  async cancelPendingForRoom(gameSlug, roomCode, status = 'cancelled', extra = {}) {
    const now = new Date();
    const historyExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const result = await GameInvite.updateMany(
      { gameSlug, roomCode, status: 'pending' },
      {
        $set: {
          status,
          respondedAt: now,
          expiresAt: historyExpiry,
          ...extra,
        },
      },
    );
    return result.modifiedCount;
  },

  /**
   * @param {string} recipientId
   */
  async expireStalePending(recipientId) {
    const now = new Date();
    const historyExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const result = await GameInvite.updateMany(
      {
        recipientId: toObjectId(recipientId),
        status: 'pending',
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: 'expired',
          respondedAt: now,
          expiresAt: historyExpiry,
        },
      },
    );
    return result.modifiedCount;
  },
};
