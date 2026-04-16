import { NpatRoom } from '../models/NpatRoom.js';

/** Mongo E11000 duplicate-key guard. */
function isDuplicateKey(err) {
  return Boolean(err && typeof err === 'object' && /** @type {any} */ (err).code === 11000);
}

export const npatRoomRepository = {
  DUPLICATE_KEY_ERROR: 'DUPLICATE_KEY',

  isDuplicateKey,

  /**
   * @param {string} code
   */
  async existsByCode(code) {
    const doc = await NpatRoom.exists({ code });
    return Boolean(doc);
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
   * Optimistic-concurrency update: applies `update` only if the stored `version` matches
   * `expectedVersion`. Increments `version`.
   * @param {string} code
   * @param {number} expectedVersion
   * @param {import('mongoose').UpdateQuery<import('mongoose').Document>} update
   * @returns {Promise<boolean>} true if update landed
   */
  async updateByCodeVersioned(code, expectedVersion, update) {
    /** @type {import('mongoose').UpdateQuery<import('mongoose').Document>} */
    const withVersion = { ...update };
    withVersion.$inc = { ...(withVersion.$inc ?? {}), version: 1 };
    const res = await NpatRoom.updateOne(
      { code, version: expectedVersion },
      withVersion,
    );
    return res.matchedCount > 0;
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

  /**
   * All non-finished rooms that still have an active engine state (for boot hydration).
   */
  findAllActive() {
    return NpatRoom.find({
      finishedAt: null,
      engineState: { $ne: 'FINISHED' },
    }).lean();
  },

  /**
   * First non-finished room the user belongs to (used for session_resumed on socket connect).
   * @param {import('mongoose').Types.ObjectId | string} userId
   */
  findActiveRoomForUser(userId) {
    return NpatRoom.findOne({
      finishedAt: null,
      'players.userId': userId,
    })
      .sort({ updatedAt: -1 })
      .lean();
  },

  /**
   * Delete finished rooms older than the given cutoff plus WAITING rooms older than `waitingCutoff`.
   * @param {{ finishedCutoff: Date, waitingCutoff: Date }} opts
   */
  async cleanupStale({ finishedCutoff, waitingCutoff }) {
    const [finished, abandoned] = await Promise.all([
      NpatRoom.deleteMany({ finishedAt: { $ne: null, $lt: finishedCutoff } }),
      NpatRoom.deleteMany({
        engineState: 'WAITING',
        createdAt: { $lt: waitingCutoff },
      }),
    ]);
    return { finished: finished.deletedCount ?? 0, abandoned: abandoned.deletedCount ?? 0 };
  },
};
