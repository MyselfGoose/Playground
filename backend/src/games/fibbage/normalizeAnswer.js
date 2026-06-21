/**
 * Normalize an answer string for comparison.
 * Strips punctuation, collapses whitespace, lowercases.
 *
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function normalizeAnswer(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check if a submitted lie is too close to the real answer.
 * Exact normalized match is always blocked. Near-matches (Levenshtein < 2) are optionally blocked.
 *
 * @param {string} submission
 * @param {string} truth
 * @returns {boolean} true if the submission should be rejected
 */
export function isTooCloseToTruth(submission, truth) {
  const normSub = normalizeAnswer(submission);
  const normTruth = normalizeAnswer(truth);
  if (!normSub || !normTruth) return false;
  return normSub === normTruth;
}
