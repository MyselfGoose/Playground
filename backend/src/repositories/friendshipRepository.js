import mongoose from 'mongoose';
import { Friendship } from '../models/Friendship.js';

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
function mapFriendship(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    requesterId: String(doc.requesterId),
    recipientId: String(doc.recipientId),
    status: doc.status,
    respondedAt: doc.respondedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const friendshipRepository = {
  /**
   * @param {string} requesterId
   * @param {string} recipientId
   */
  findDirected(requesterId, recipientId) {
    return Friendship.findOne({
      requesterId: toObjectId(requesterId),
      recipientId: toObjectId(recipientId),
    })
      .lean()
      .then(mapFriendship);
  },

  /**
   * @param {string} userId
   */
  async listAcceptedFriends(userId) {
    const oid = toObjectId(userId);
    const rows = await Friendship.find({
      status: 'accepted',
      $or: [{ requesterId: oid }, { recipientId: oid }],
    })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
    return rows.map(mapFriendship);
  },

  /**
   * @param {string} userId
   */
  async listPendingReceived(userId) {
    const rows = await Friendship.find({
      recipientId: toObjectId(userId),
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean();
    return rows.map(mapFriendship);
  },

  /**
   * @param {string} userId
   */
  async listSentByUser(userId) {
    const rows = await Friendship.find({
      requesterId: toObjectId(userId),
      status: { $in: ['pending', 'declined'] },
    })
      .sort({ updatedAt: -1 })
      .lean();
    return rows.map(mapFriendship);
  },

  /**
   * @param {string} id
   */
  findById(id) {
    return Friendship.findById(id).lean().then(mapFriendship);
  },

  /**
   * @param {string} requesterId
   * @param {string} recipientId
   */
  async createPending(requesterId, recipientId) {
    const created = await Friendship.create({
      requesterId: toObjectId(requesterId),
      recipientId: toObjectId(recipientId),
      status: 'pending',
      respondedAt: null,
    });
    return mapFriendship(created.toObject());
  },

  /**
   * @param {string} id
   * @param {'accepted'|'declined'|'cancelled'|'pending'} status
   */
  async updateStatus(id, status) {
    const updated = await Friendship.findOneAndUpdate(
      { _id: toObjectId(id), status: { $ne: status } },
      {
        $set: {
          status,
          respondedAt: status === 'pending' ? null : new Date(),
        },
      },
      { new: true },
    ).lean();
    return mapFriendship(updated);
  },

  /**
   * @param {string} id
   * @param {'pending'} fromStatus
   */
  async transitionStatus(id, fromStatus, toStatus) {
    const updated = await Friendship.findOneAndUpdate(
      { _id: toObjectId(id), status: fromStatus },
      {
        $set: {
          status: toStatus,
          respondedAt: toStatus === 'pending' ? null : new Date(),
        },
      },
      { new: true },
    ).lean();
    return mapFriendship(updated);
  },

  /**
   * @param {string} id
   */
  deleteById(id) {
    return Friendship.deleteOne({ _id: toObjectId(id) });
  },

  /**
   * @param {string} userA
   * @param {string} userB
   */
  async deleteAcceptedBetween(userA, userB) {
    const a = toObjectId(userA);
    const b = toObjectId(userB);
    return Friendship.deleteOne({
      status: 'accepted',
      $or: [
        { requesterId: a, recipientId: b },
        { requesterId: b, recipientId: a },
      ],
    });
  },

  /**
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async listAcceptedFriendUserIds(userId) {
    const friendships = await this.listAcceptedFriends(userId);
    return friendships.map((f) =>
      f.requesterId === userId ? f.recipientId : f.requesterId,
    );
  },

  /**
   * @param {string} userA
   * @param {string} userB
   */
  async areFriends(userA, userB) {
    if (!userA || !userB || userA === userB) return false;
    const a = toObjectId(userA);
    const b = toObjectId(userB);
    const row = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requesterId: a, recipientId: b },
        { requesterId: b, recipientId: a },
      ],
    }).lean();
    return Boolean(row);
  },
};
