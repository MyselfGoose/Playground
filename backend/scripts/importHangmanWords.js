import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';
import { DEFAULT_HANGMAN_DATASET_VERSION } from '../src/config/hangmanDefaults.js';
import { HangmanWord } from '../src/models/HangmanWord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCH = 500;
const MIN_LEN = 4;
const MAX_LEN = 24;

function getArg(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function normalizeWord(raw) {
  const w = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC');
  if (!w || w.startsWith('#')) return null;
  if (!/^[a-z]+$/.test(w)) return null;
  if (w.length < MIN_LEN || w.length > MAX_LEN) return null;
  return w;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const datasetVersion = getArg('--dataset-version') ?? DEFAULT_HANGMAN_DATASET_VERSION;
  const inputPath =
    getArg('--path') ?? path.resolve(__dirname, '../data/hangman-words-en-v1.txt');
  const dryRun = process.argv.includes('--dry-run');

  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  await mongoose.connect(mongoUri);

  const text = await fs.readFile(inputPath, 'utf8');
  const seen = new Set();
  const words = [];
  for (const line of text.split(/\r?\n/)) {
    const w = normalizeWord(line);
    if (!w || seen.has(w)) continue;
    seen.add(w);
    words.push({
      datasetVersion,
      word: w,
      length: w.length,
      difficulty: Math.min(5, Math.max(1, Math.round(w.length / 3))),
      locale: 'en',
    });
  }

  console.log(`Parsed ${words.length} unique valid words from ${inputPath}`);
  if (dryRun) {
    console.log('Dry run — no DB writes.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let upserts = 0;
  for (const part of chunk(words, BATCH)) {
    const ops = part.map((doc) => ({
      updateOne: {
        filter: { datasetVersion: doc.datasetVersion, word: doc.word },
        update: {
          $set: {
            length: doc.length,
            difficulty: doc.difficulty,
            locale: doc.locale,
          },
          $setOnInsert: {
            datasetVersion: doc.datasetVersion,
            word: doc.word,
          },
        },
        upsert: true,
      },
    }));
    const res = await HangmanWord.bulkWrite(ops, { ordered: false });
    upserts += res.upsertedCount + res.modifiedCount + res.matchedCount;
  }

  console.log(`Bulk write completed (${upserts} ops touched). Dataset version: ${datasetVersion}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
