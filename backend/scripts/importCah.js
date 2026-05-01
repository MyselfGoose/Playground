import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';
import { CahBlackCard } from '../src/models/CahBlackCard.js';
import { CahWhiteCard } from '../src/models/CahWhiteCard.js';
import { parseAndNormalizeCahCards } from '../src/services/cah/cahImportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../../against-humanity-master/source/cards.json');
const DEFAULT_DATASET_VERSION = 'cah-legacy-v1';
const BATCH_SIZE = 500;

function getArg(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function createUpsertOps(cards, isBlack) {
  return cards.map((card) => ({
    updateOne: {
      filter: { datasetVersion: card.datasetVersion, sourceId: card.sourceId },
      update: {
        $set: isBlack
          ? {
              text: card.text,
              rawText: card.rawText,
              pick: card.pick,
              pack: card.pack,
              textHash: card.textHash,
            }
          : {
              text: card.text,
              rawText: card.rawText,
              pack: card.pack,
              textHash: card.textHash,
            },
        $setOnInsert: {
          datasetVersion: card.datasetVersion,
          sourceId: card.sourceId,
        },
      },
      upsert: true,
    },
  }));
}

async function runBulkWrites(Model, ops) {
  let matchedCount = 0;
  let modifiedCount = 0;
  let upsertedCount = 0;

  for (const group of chunk(ops, BATCH_SIZE)) {
    const result = await Model.bulkWrite(group, { ordered: false });
    matchedCount += result.matchedCount ?? 0;
    modifiedCount += result.modifiedCount ?? 0;
    upsertedCount += result.upsertedCount ?? 0;
  }

  return { matchedCount, modifiedCount, upsertedCount };
}

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  const datasetPath = getArg('--dataset') || process.env.CAH_DATASET_PATH?.trim() || DEFAULT_DATASET_PATH;
  const datasetVersion =
    getArg('--dataset-version') || process.env.CAH_DATASET_VERSION?.trim() || DEFAULT_DATASET_VERSION;

  const resolvedPath = path.resolve(datasetPath);
  console.log('[cah-import] starting', { datasetPath: resolvedPath, datasetVersion });

  const raw = await fs.readFile(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const {
    blackCards,
    whiteCards,
    counters,
    duplicateDiagnostics: duplicates,
  } = parseAndNormalizeCahCards(parsed, { datasetVersion });

  await mongoose.connect(mongoUri);
  await Promise.all([CahBlackCard.syncIndexes(), CahWhiteCard.syncIndexes()]);

  const blackResult = await runBulkWrites(CahBlackCard, createUpsertOps(blackCards, true));
  const whiteResult = await runBulkWrites(CahWhiteCard, createUpsertOps(whiteCards, false));

  const [blackTotal, whiteTotal, blackPacks, whitePacks] = await Promise.all([
    CahBlackCard.countDocuments({ datasetVersion }),
    CahWhiteCard.countDocuments({ datasetVersion }),
    CahBlackCard.distinct('pack', { datasetVersion }),
    CahWhiteCard.distinct('pack', { datasetVersion }),
  ]);

  const summary = {
    datasetVersion,
    parsed: counters.parsed,
    normalizedBlack: counters.black,
    normalizedWhite: counters.white,
    skippedInvalid: counters.skippedInvalid,
    invalidReasons: counters.invalidReasons,
    writes: {
      black: blackResult,
      white: whiteResult,
    },
    totalsInDb: {
      black: blackTotal,
      white: whiteTotal,
    },
    duplicateTextDiagnostics: {
      black: duplicates.black.length,
      white: duplicates.white.length,
    },
    packCoverage: {
      black: blackPacks.sort(),
      white: whitePacks.sort(),
    },
  };

  if (duplicates.black.length > 0 || duplicates.white.length > 0) {
    console.warn('[cah-import] duplicate text entries detected', {
      black: duplicates.black.slice(0, 5),
      white: duplicates.white.slice(0, 5),
    });
  }

  console.log('[cah-import] completed', summary);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[cah-import] failed', {
    message: err?.message,
    stack: err?.stack,
  });
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect failures on fatal path
  }
  process.exit(1);
});
