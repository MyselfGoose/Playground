/**
 * Destructive: removes all users and refresh sessions. Never for production.
 * Requires `ALLOW_DB_RESET=true` and `NODE_ENV` not `production`.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { RefreshSession } from '../src/models/RefreshSession.js';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset is disabled in production');
  }
  if (process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('Set ALLOW_DB_RESET=true to confirm database reset');
  }
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;

  await mongoose.connect(mongoUri);
  const [users, sessions] = await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
  ]);
  console.log('db:reset completed', { deletedUsers: users.deletedCount, deletedSessions: sessions.deletedCount });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
