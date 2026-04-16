import { NpatRoom } from '../models/NpatRoom.js';

export const npatRoomRepository = {
  /**
   * @param {string} code
   */
  existsByCode(code) {
    return NpatRoom.exists({ code });
  },

  /**
   * @param {import('mongoose').FilterQuery<import('mongoose').Document>} doc
   */
  async create(doc) {
    const row = await NpatRoom.create(doc);
    return row.toObject();
  },

  /**
   * @param {string} code
   * @param {import('mongoose').UpdateQuery<import('mongoose').Document>} update
   */
  updateByCode(code, update) {
    return NpatRoom.updateOne({ code }, update);
  },

  /**
   * @param {string} code
   */
  findByCode(code) {
    return NpatRoom.findOne({ code }).lean();
  },

  /**
   * @param {string} code
   */
  deleteByCode(code) {
    return NpatRoom.deleteOne({ code });
  },
};
