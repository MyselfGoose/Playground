import { HangmanWord } from '../models/HangmanWord.js';

/**
 * @param {{
 *   datasetVersion: string,
 *   minLength?: number,
 *   maxLength?: number,
 *   difficulty?: number,
 * }} filters
 * @returns {Promise<{ word: string, length: number } | null>}
 */
export async function randomHangmanWord(filters) {
  const { datasetVersion, minLength = 4, maxLength = 24, difficulty } = filters;
  const match = {
    datasetVersion,
    length: { $gte: minLength, $lte: maxLength },
  };
  if (difficulty != null && Number.isFinite(difficulty)) {
    match.difficulty = difficulty;
  }
  const rows = await HangmanWord.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
  const doc = rows[0];
  if (!doc) return null;
  return { word: doc.word, length: doc.length };
}

export const hangmanWordRepository = {
  randomWord: randomHangmanWord,
};
