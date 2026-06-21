/**
 * Idempotent: grants admin role to abubakar20069@gmail.com.
 * Run from backend root: `node scripts/grant-admin.js`
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';

const ADMIN_EMAIL = 'abubakar20069@gmail.com';

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  await mongoose.connect(mongoUri);

  const result = await User.updateOne(
    { email: ADMIN_EMAIL.toLowerCase() },
    { $addToSet: { roles: 'admin' } },
  );

  if (result.matchedCount === 0) {
    console.warn(`[grant-admin] No user found with email ${ADMIN_EMAIL}. Register first, then re-run.`);
  } else {
    console.log(`[grant-admin] Admin role granted to ${ADMIN_EMAIL}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
