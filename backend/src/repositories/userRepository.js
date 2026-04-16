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
   * @param {{ username: string, email: string, passwordHash: string, roles?: string[] }} doc
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
};
