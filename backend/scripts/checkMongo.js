/**
 * Quick MongoDB connectivity check (used by repo root ./startup).
 * Run from backend directory so dotenv loads backend/.env and node_modules resolve.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI?.trim();
if (!uri) {
  console.error('MONGO_URI is not set. Create backend/.env or rely on dev defaults with NODE_ENV=development.');
  process.exit(1);
}

const timeoutMs = Number(process.env.MONGO_CHECK_TIMEOUT_MS || 8000);

try {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
  await mongoose.disconnect();
  console.log('MongoDB: connection OK');
} catch (err) {
  console.error('MongoDB: connection failed:', err.message);
  process.exit(1);
}
