import mongoose from 'mongoose';
import '../models/User.js';
import '../models/RefreshSession.js';

/**
 * Log MongoDB host without credentials.
 * @param {string} mongoUri
 */
export function mongoUriMeta(mongoUri) {
  try {
    const u = new URL(mongoUri);
    return { host: u.host, pathname: u.pathname || '/' };
  } catch {
    return { host: 'unparseable_uri' };
  }
}

const MAX_ATTEMPTS = 8;
const INITIAL_DELAY_MS = 500;

/**
 * @param {{ mongoUri: string, logger: import('pino').Logger }} params
 */
export async function connectDb({ mongoUri, logger }) {
  const meta = mongoUriMeta(mongoUri);
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      mongoose.set('strictQuery', true);
      await mongoose.connect(mongoUri);
      logger.info({ ...meta, attempt }, 'mongodb_connected');
      return;
    } catch (err) {
      logger.warn({ err, ...meta, attempt, maxAttempts: MAX_ATTEMPTS }, 'mongodb_connect_attempt_failed');
      if (attempt >= MAX_ATTEMPTS) {
        logger.error({ ...meta }, 'mongodb_connect_exhausted');
        throw err;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10_000);
    }
  }
}

/**
 * @param {{ logger: import('pino').Logger }} params
 */
export async function disconnectDb({ logger }) {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  try {
    await mongoose.disconnect();
    logger.info('mongodb_disconnected');
  } catch (err) {
    logger.error({ err }, 'mongodb_disconnect_error');
    throw err;
  }
}
