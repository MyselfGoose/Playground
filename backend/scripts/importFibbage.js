import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { FibbagePrompt } from '../src/models/FibbagePrompt.js';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  await mongoose.connect(mongoUri);

  const dataPath = join(__dirname, '..', 'src', 'games', 'fibbage', 'data', 'fibbage-prompts-v1.json');
  const prompts = JSON.parse(readFileSync(dataPath, 'utf8'));
  console.log(`[importFibbage] Loaded ${prompts.length} prompts`);

  let upserted = 0;
  let skipped = 0;

  for (const prompt of prompts) {
    const textHash = createHash('sha256').update(prompt.text.trim().toLowerCase()).digest('hex').slice(0, 16);
    try {
      await FibbagePrompt.updateOne(
        { sourceId: prompt.sourceId },
        {
          $set: {
            datasetVersion: 'fibbage-v1',
            text: prompt.text,
            answer: prompt.answer,
            category: prompt.category,
            difficulty: prompt.difficulty ?? 2,
            textHash,
            locale: 'en',
            active: true,
          },
        },
        { upsert: true },
      );
      upserted++;
    } catch (err) {
      console.warn(`[importFibbage] Skip ${prompt.sourceId}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`[importFibbage] Done: ${upserted} upserted, ${skipped} skipped`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
