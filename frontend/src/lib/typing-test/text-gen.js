import wordsJson from "./datasets/words.json" with { type: "json" };
import sentencesJson from "./datasets/sentences.json" with { type: "json" };
import { mulberry32, randomInt } from "./rng.js";

/** @type {readonly string[]} */
const WORDS = wordsJson;

/** @type {readonly string[]} */
const SENTENCES = sentencesJson;

export const TIME_LIMITS_SEC = [15, 30, 60, 120];
export const WORD_TARGETS = [10, 25, 50, 100];

/** ~average English word length including space for time-mode budgeting */
const AVG_CHARS_PER_WORD = 6;

/**
 * Normalize passage: single spaces between tokens; preserve sentence punctuation in sentence mode.
 * @param {string} s
 */
export function normalizePassage(s) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word mode: exactly `count` words, no immediate repeats where possible.
 * @param {number} seed
 * @param {number} wordCount
 */
export function generateWordCountPassage(wordCount, seed) {
  const rng = mulberry32(seed);
  const parts = [];
  let prev = "";
  for (let i = 0; i < wordCount; i++) {
    let w = WORDS[randomInt(rng, 0, WORDS.length - 1)];
    let guard = 0;
    while (w === prev && guard++ < 12) {
      w = WORDS[randomInt(rng, 0, WORDS.length - 1)];
    }
    prev = w;
    parts.push(w);
  }
  return parts.join(" ");
}

/**
 * Time mode: long passage so fast typists rarely exhaust before timer.
 * ~targetChars scales with expected typing at high WPM for `limitSec`.
 * @param {number} seed
 * @param {number} limitSec
 */
export function generateTimeModePassage(seed, limitSec) {
  const rng = mulberry32(seed);
  /** Enough for ~220 WPM for 1.5× limit, plus buffer */
  const targetChars = Math.ceil(limitSec * (220 / 60) * AVG_CHARS_PER_WORD * 1.5 + 800);
  const parts = [];
  let prev = "";
  let len = 0;
  let guard = 0;
  while (len < targetChars && guard++ < 50000) {
    let w = WORDS[randomInt(rng, 0, WORDS.length - 1)];
    let g2 = 0;
    while (w === prev && g2++ < 20) {
      w = WORDS[randomInt(rng, 0, WORDS.length - 1)];
    }
    prev = w;
    parts.push(w);
    len += w.length + (parts.length > 1 ? 1 : 0);
  }
  return normalizePassage(parts.join(" "));
}

/**
 * Optional sentence-style variety: sample sentences concatenated (space-separated).
 * @param {number} seed
 * @param {number} approxWords — rough target word count
 */
export function generateSentencePassage(approxWords, seed) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let out = [];
  let words = 0;
  let prev = -1;
  while (words < approxWords) {
    let idx = randomInt(rng, 0, SENTENCES.length - 1);
    let tries = 0;
    while (idx === prev && tries++ < 10) {
      idx = randomInt(rng, 0, SENTENCES.length - 1);
    }
    prev = idx;
    const s = SENTENCES[idx];
    out.push(s);
    words += s.split(/\s+/).length;
    if (out.length > 40) break;
  }
  return normalizePassage(out.join(" "));
}

/**
 * @param {{
 *   mode: 'time' | 'words';
 *   seed: number;
 *   timeLimitSec?: number;
 *   wordTarget?: number;
 *   useSentences?: boolean;
 * }} opts
 */
export function generatePassage(opts) {
  if (opts.mode === "words") {
    const n = opts.wordTarget ?? 25;
    if (opts.useSentences) {
      return generateSentencePassage(n * 8, opts.seed);
    }
    return generateWordCountPassage(n, opts.seed);
  }
  const sec = opts.timeLimitSec ?? 60;
  if (opts.useSentences) {
    const approxWords = Math.ceil(sec * 3.5);
    return generateSentencePassage(approxWords, opts.seed);
  }
  return generateTimeModePassage(opts.seed, sec);
}
