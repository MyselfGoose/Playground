/**
 * Idempotent seed: creates admin + test user if missing (by username).
 * Run from backend root: `npm run db:seed`
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../src/models/User.js';
import {
  DEFAULT_MONGO_URI,
  DEFAULT_SEED_ADMIN_PASSWORD,
  DEFAULT_SEED_USER_PASSWORD,
} from '../src/config/devDefaults.js';

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  const cost = Number(process.env.BCRYPT_COST || 12);

  const adminUser = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPass = process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_SEED_ADMIN_PASSWORD;

  const testUser = process.env.SEED_USER_USERNAME || 'testuser';
  const testEmail = process.env.SEED_USER_EMAIL || 'testuser@example.com';
  const testPass = process.env.SEED_USER_PASSWORD?.trim() || DEFAULT_SEED_USER_PASSWORD;

  if (!process.env.SEED_ADMIN_PASSWORD?.trim() || !process.env.SEED_USER_PASSWORD?.trim()) {
    console.warn(
      '[seed] SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD not set — using default dev passwords from devDefaults.js (change for shared environments).',
    );
  }

  await mongoose.connect(mongoUri);

  const adminHash = await bcrypt.hash(adminPass, cost);
  const testHash = await bcrypt.hash(testPass, cost);

  await User.findOneAndUpdate(
    { username: adminUser },
    {
      $set: {
        email: adminEmail.toLowerCase(),
        passwordHash: adminHash,
        roles: ['admin', 'user'],
        isActive: true,
      },
      $setOnInsert: { username: adminUser },
    },
    { upsert: true },
  );

  await User.findOneAndUpdate(
    { username: testUser },
    {
      $set: {
        email: testEmail.toLowerCase(),
        passwordHash: testHash,
        roles: ['user'],
        isActive: true,
      },
      $setOnInsert: { username: testUser },
    },
    { upsert: true },
  );

  console.log('Seed completed:', { adminUser, testUser });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
