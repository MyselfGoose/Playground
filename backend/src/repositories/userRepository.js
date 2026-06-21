import mongoose from 'mongoose';
import { User } from '../models/User.js';

/**
 * @param {string} raw
 */
function buildSearchFilter(raw) {
  const q = raw.trim();
  if (!q) return {};

  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    return { _id: new mongoose.Types.ObjectId(q) };
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  return {
    $or: [
      { username: regex },
      { email: regex },
      { googleId: q },
    ],
  };
}

export const userRepository = {
  /**
   * @param {string} email
   */
  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() }).lean();
  },

  /**
   * @param {string} email
   */
  findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+passwordHash').lean();
  },

  /**
   * @param {string} googleId
   */
  findByGoogleId(googleId) {
    return User.findOne({ googleId }).lean();
  },

  /**
   * @param {string} username
   */
  findByUsername(username) {
    return User.findOne({ username }).lean();
  },

  /**
   * @param {string} username
   * @param {string} excludeUserId
   */
  findByUsernameExcluding(username, excludeUserId) {
    return User.findOne({ username, _id: { $ne: excludeUserId } }).lean();
  },

  /**
   * @param {import('mongoose').Types.ObjectId | string} userId
   * @param {Record<string, unknown>} patch
   */
  async updateProfile(userId, patch) {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: patch },
      { new: true, runValidators: true },
    )
      .select('-__v')
      .lean();
    return updated;
  },

  /**
   * @param {string} username
   */
  findByUsernameWithPassword(username) {
    return User.findOne({ username }).select('+passwordHash').lean();
  },

  /**
   * @param {{ username: string, email: string, passwordHash?: string, googleId?: string, authProviders?: string[], avatarUrl?: string, roles?: string[] }} doc
   */
  async createUser(doc) {
    const created = await User.create(doc);
    return created.toObject({ virtuals: true });
  },

  /**
   * @param {string} id
   */
  findByIdLean(id) {
    return User.findById(id).select('-__v').lean();
  },

  /**
   * @param {string[]} ids
   */
  async findAvatarsByIds(ids) {
    if (!ids.length) return {};
    const users = await User.find({ _id: { $in: ids } })
      .select('username avatarUrl avatarEmoji')
      .lean();
    /** @type {Record<string, { username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>} */
    const map = {};
    for (const u of users) {
      map[String(u._id)] = u;
    }
    return map;
  },

  /**
   * @param {import('mongoose').Types.ObjectId | string} userId
   */
  updateLastLogin(userId) {
    return User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
  },

  /**
   * Link Google to an existing account when googleId is unset or already matches.
   * @param {import('mongoose').Types.ObjectId | string} userId
   * @param {{ googleId: string, avatarUrl?: string | null, authProviders: string[] }} patch
   */
  async linkGoogleAccount(userId, patch) {
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        $or: [{ googleId: null }, { googleId: { $exists: false } }, { googleId: patch.googleId }],
      },
      {
        $set: {
          googleId: patch.googleId,
          ...(patch.avatarUrl ? { avatarUrl: patch.avatarUrl } : {}),
          authProviders: patch.authProviders,
        },
      },
      { new: true },
    )
      .select('-__v')
      .lean();
    return updated;
  },

  /**
   * @param {string} query
   * @param {{ page?: number, limit?: number }} [opts]
   */
  async searchUsers(query, { page = 1, limit = 20 } = {}) {
    const filter = buildSearchFilter(query);
    const cappedLimit = Math.max(1, Math.min(100, limit));
    const skip = Math.max(0, (Math.max(1, page) - 1) * cappedLimit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(cappedLimit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return { users, total, page: Math.max(1, page), limit: cappedLimit };
  },

  countUsers() {
    return User.countDocuments({});
  },

  /**
   * @param {Date} since
   */
  countSignupsSince(since) {
    return User.countDocuments({ createdAt: { $gte: since } });
  },

  /**
   * @param {Date} since
   */
  countActiveSince(since) {
    return User.countDocuments({ lastLoginAt: { $gte: since } });
  },

  /**
   * @param {number} limit
   */
  listRecentSignups(limit = 10) {
    const capped = Math.max(1, Math.min(50, limit));
    return User.find({})
      .select('username email authProviders isActive roles createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .limit(capped)
      .lean();
  },

  /**
   * Stream users for CSV export (cursor).
   * @param {{ maxRows?: number }} [opts]
   */
  exportUsersCursor({ maxRows = 50_000 } = {}) {
    return User.find({})
      .select('email username createdAt lastLoginAt isActive')
      .sort({ createdAt: -1 })
      .limit(maxRows)
      .lean()
      .cursor();
  },
};
