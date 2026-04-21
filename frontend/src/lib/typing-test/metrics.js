/**
 * Live and final typing metrics — formulas documented in UI tooltips.
 *
 * - Net WPM: (correctChars / 5) / (elapsedMinutes)
 * - Raw WPM: (all keystroke “units”) / (elapsedMinutes) where units = correct + incorrect + extra counts
 * - Accuracy: correct / (correct + incorrect + extra) × 100
 */

/** @param {number} n */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * @param {{
 *   correctChars: number;
 *   incorrectChars: number;
 *   extraChars: number;
 * }} s
 * @param {number} elapsedSec > 0 for meaningful rates
 */
export function computeTypingMetrics(s, elapsedSec) {
  const denom = s.correctChars + s.incorrectChars + s.extraChars;
  const accuracy =
    denom === 0 ? 100 : clamp((100 * s.correctChars) / denom, 0, 100);

  let wpm = 0;
  let rawWpm = 0;
  if (elapsedSec > 0) {
    const minutes = elapsedSec / 60;
    wpm = (s.correctChars / 5) / minutes;
    rawWpm = denom / 5 / minutes;
  }

  return {
    wpm,
    rawWpm,
    accuracy,
    errorCount: s.incorrectChars + s.extraChars,
  };
}

/**
 * Consistency: lower stddev of per-bucket WPM = higher score.
 * Uses coefficient of variation in [0, 100] where higher is more consistent.
 *
 * @param {number[]} bucketWpm — one WPM per time slice
 */
export function computeConsistency(bucketWpm) {
  if (!bucketWpm.length || bucketWpm.length < 3) return null;
  const mean =
    bucketWpm.reduce((a, b) => a + b, 0) / bucketWpm.length;
  if (mean <= 0) return null;
  const variance =
    bucketWpm.reduce((acc, x) => acc + (x - mean) ** 2, 0) /
    bucketWpm.length;
  const std = Math.sqrt(variance);
  const cv = std / mean;
  /** Map low CV to high score */
  const score = clamp(100 - cv * 100, 0, 100);
  return score;
}
