import { HangmanGameResult } from '../models/HangmanGameResult.js';

export const hangmanGameResultRepository = {
  /**
   * @param {Record<string, unknown>} doc
   */
  async insertOne(doc) {
    return HangmanGameResult.create(doc);
  },
};
