import { HangmanRoundResult } from '../models/HangmanRoundResult.js';

export const hangmanRoundResultRepository = {
  /**
   * @param {Record<string, unknown>} doc
   */
  async insertOne(doc) {
    return HangmanRoundResult.create(doc);
  },
};
