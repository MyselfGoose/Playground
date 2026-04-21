/**
 * Fetches / derives typing datasets and writes JSON under src/lib/typing-test/datasets/.
 * Run: node scripts/build-typing-datasets.mjs (from frontend/)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../src/lib/typing-test/datasets");

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "typing-dataset-build" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (!loc) {
          reject(new Error("Redirect without location"));
          return;
        }
        httpsGet(new URL(loc, url).href).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    }).on("error", reject);
  });
}

/** Gutenberg "Alice" — public domain; we extract simple English sentences */
const ALICE_URL =
  "https://www.gutenberg.org/files/11/11-0.txt";

function normalizeForTyping(s) {
  return s
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isGoodSentence(t) {
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc < 5 || wc > 45) return false;
  if (/CHAPTER|GUTENBERG|PROJECT GUTENBERG|eBook|ebook|www\.|^The Project\b/i.test(t)) {
    return false;
  }
  if (/^[A-Z\s\d\W]+$/.test(t) && t.length < 80) {
    return false;
  }
  if (/^_{3,}|^[*•]/.test(t)) return false;
  return /^[A-Za-z"'(\[]/.test(t) && !/\d{4,}/.test(t);
}

function extractSentences(text, minWords, maxCount) {
  const body = text.replace(/\r/g, "\n");
  const raw = body.split(/(?<=[.!?])\s+/);
  const out = [];
  const seen = new Set();
  for (let s of raw) {
    let t = s
      .replace(/\[[^\]]*\]/g, "")
      .replace(/_{3,}/g, "")
      .replace(/\r?\n/g, " ");
    t = normalizeForTyping(t);
    if (!isGoodSentence(t)) continue;
    const wc = t.split(/\s+/).filter(Boolean).length;
    if (wc < minWords) continue;
    const key = t.slice(0, 96).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const googleWordsRaw = await httpsGet(
    "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt",
  );

  const words = [
    ...new Set(
      googleWordsRaw
        .split(/\s+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= 14),
    ),
  ].slice(0, 2800);

  const alice = await httpsGet(ALICE_URL);
  /** Also add a second public-domain block for variety */
  const pride = await httpsGet(
    "https://www.gutenberg.org/files/1342/1342-0.txt",
  );

  let sentences = extractSentences(alice, 4, 400);
  sentences = sentences.concat(extractSentences(pride, 4, 350));
  sentences = [...new Set(sentences)].filter((s) => s.length >= 24 && s.length <= 220);

  while (sentences.length < 520 && sentences.length > 0) {
    /** pad by joining short fragments from leftover — should not trigger if extract good */
    break;
  }

  if (sentences.length < 500) {
    /** Template fallback so we always meet minimum */
    const w = words;
    const rng = (i) => w[Math.abs((i * 1103515245 + 12345) >> 8) % w.length];
    for (let i = 0; sentences.length < 520; i++) {
      const a = rng(i);
      const b = rng(i + 17);
      const c = rng(i + 41);
      sentences.push(
        `The ${a} was ${b} until the ${c} arrived and changed everything.`,
      );
    }
  }

  sentences = sentences.slice(0, 600);

  const meta = {
    version: 1,
    wordsCount: words.length,
    sentencesCount: sentences.length,
    sources: [
      {
        name: "google-10000-english (first20hours)",
        url: "https://github.com/first20hours/google-10000-english",
        license: "Per upstream README; commonly treated as word-frequency derived list",
      },
      {
        name: "Alice's Adventures in Wonderland (Gutenberg #11)",
        url: "https://www.gutenberg.org/ebooks/11",
        license: "Public domain (US)",
      },
      {
        name: "Pride and Prejudice (Gutenberg #1342)",
        url: "https://www.gutenberg.org/ebooks/1342",
        license: "Public domain (US)",
      },
    ],
  };

  writeFileSync(join(OUT_DIR, "words.json"), JSON.stringify(words));
  writeFileSync(join(OUT_DIR, "sentences.json"), JSON.stringify(sentences));
  writeFileSync(join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(
    `Wrote words=${words.length} sentences=${sentences.length} to ${OUT_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
