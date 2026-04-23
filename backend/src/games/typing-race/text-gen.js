import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, randomInt } from "./rng.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WORDS = JSON.parse(
  readFileSync(join(__dirname, "datasets", "words.json"), "utf8"),
);

/**
 * @param {number} wordCount
 * @param {number} seed
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
 * @param {number} seed
 */
export function generateRacePassage(seed) {
  /** Fixed multiplayer length for fairness */
  return generateWordCountPassage(40, seed);
}
