import { User } from '../models/User.js';

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
};
