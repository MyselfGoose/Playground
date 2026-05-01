import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';
import { CahBlackCard } from '../src/models/CahBlackCard.js';
import { CahWhiteCard } from '../src/models/CahWhiteCard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATASET_VERSION = process.env.CAH_DATASET_VERSION?.trim() || 'cah-legacy-v1';
const QUESTIONS_PATH = path.resolve(__dirname, '../../against-humanity-master/questions.txt');
const ANSWERS_PATH = path.resolve(__dirname, '../../against-humanity-master/answers.txt');

function countNonEmptyLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  const datasetVersion = process.argv[2] || DEFAULT_DATASET_VERSION;

  const [questionsRaw, answersRaw] = await Promise.all([
    fs.readFile(QUESTIONS_PATH, 'utf8'),
    fs.readFile(ANSWERS_PATH, 'utf8'),
  ]);
  const expectedBlack = countNonEmptyLines(questionsRaw);
  const expectedWhite = countNonEmptyLines(answersRaw);

  await mongoose.connect(mongoUri);

  const [
    blackCount,
    whiteCount,
    invalidBlackPick,
    invalidWhiteText,
    duplicateBlackSource,
    duplicateWhiteSource,
    sampleBlack,
    sampleWhite,
  ] = await Promise.all([
    CahBlackCard.countDocuments({ datasetVersion }),
    CahWhiteCard.countDocuments({ datasetVersion }),
    CahBlackCard.countDocuments({ datasetVersion, pick: { $lte: 0 } }),
    CahWhiteCard.countDocuments({ datasetVersion, text: '' }),
    CahBlackCard.aggregate([
      { $match: { datasetVersion } },
      { $group: { _id: '$sourceId', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'duplicates' },
    ]),
    CahWhiteCard.aggregate([
      { $match: { datasetVersion } },
      { $group: { _id: '$sourceId', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'duplicates' },
    ]),
    CahBlackCard.aggregate([{ $match: { datasetVersion } }, { $sample: { size: 1 } }]),
    CahWhiteCard.aggregate([{ $match: { datasetVersion } }, { $sample: { size: 1 } }]),
  ]);

  const failed = [];
  if (blackCount !== expectedBlack) {
    failed.push(`black count mismatch: expected=${expectedBlack}, actual=${blackCount}`);
  }
  if (whiteCount !== expectedWhite) {
    failed.push(`white count mismatch: expected=${expectedWhite}, actual=${whiteCount}`);
  }
  if (invalidBlackPick > 0) {
    failed.push(`invalid black pick count=${invalidBlackPick}`);
  }
  if (invalidWhiteText > 0) {
    failed.push(`invalid white text count=${invalidWhiteText}`);
  }
  if ((duplicateBlackSource[0]?.duplicates ?? 0) > 0) {
    failed.push(`duplicate black sourceId rows=${duplicateBlackSource[0].duplicates}`);
  }
  if ((duplicateWhiteSource[0]?.duplicates ?? 0) > 0) {
    failed.push(`duplicate white sourceId rows=${duplicateWhiteSource[0].duplicates}`);
  }

  console.log('[cah-validate] summary', {
    datasetVersion,
    expected: { black: expectedBlack, white: expectedWhite },
    actual: { black: blackCount, white: whiteCount },
    sampleBlack: sampleBlack[0] ? { sourceId: sampleBlack[0].sourceId, pick: sampleBlack[0].pick, pack: sampleBlack[0].pack } : null,
    sampleWhite: sampleWhite[0] ? { sourceId: sampleWhite[0].sourceId, pack: sampleWhite[0].pack } : null,
    failedChecks: failed,
  });

  await mongoose.disconnect();
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('[cah-validate] failed', { message: err?.message, stack: err?.stack });
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
