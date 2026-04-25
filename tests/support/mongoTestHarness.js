/**
 * Import mongoose from the backend package tree so Models (loaded via backend/src)
 * and test harness share one connection singleton.
 */
import mongoose from '../../backend/node_modules/mongoose/index.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

/** @type {MongoMemoryServer | null} */
let mem = null;

/**
 * Start in-memory MongoDB and set process.env.MONGO_URI for the current process.
 * @returns {Promise<string>} connection URI
 */
export async function startMongoMemoryServer() {
  if (mem) return mem.getUri();
  mem = await MongoMemoryServer.create();
  const uri = mem.getUri();
  process.env.MONGO_URI = uri;
  return uri;
}

export async function stopMongoMemoryServer() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mem) {
    await mem.stop();
    mem = null;
  }
}

/**
 * Connect mongoose to MONGO_URI (must be set, e.g. by memory server).
 */
export async function connectMongoose() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set — run startMongoMemoryServer() first');
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function dropAllCollections() {
  const db = mongoose.connection.db;
  if (!db) return;
  const names = await db.listCollections().toArray();
  for (const { name } of names) {
    if (name.startsWith('system.')) continue;
    await db.collection(name).deleteMany({});
  }
}
