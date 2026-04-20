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

const INITIAL_DELAY_MS = 500;
const MAX_BACKOFF_MS = 30_000;

/**
 * Blocking connect with limited retries (scripts / tests).
 * @param {{ mongoUri: string, logger: import('pino').Logger, maxAttempts?: number }} params
 */
export async function connectDbBlocking({ mongoUri, logger, maxAttempts = 8 }) {
  const meta = mongoUriMeta(mongoUri);
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      mongoose.set('strictQuery', true);
      await mongoose.connect(mongoUri);
      logger.info({ ...meta, attempt }, 'mongodb_connected');
      return;
    } catch (err) {
      logger.warn({ err, ...meta, attempt, maxAttempts }, 'mongodb_connect_attempt_failed');
      if (attempt >= maxAttempts) {
        logger.error({ ...meta }, 'mongodb_connect_exhausted');
        throw err;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10_000);
    }
  }
}

/**
 * Non-blocking: retries in the background forever until connected. HTTP server must start without awaiting this.
 * @param {{ mongoUri: string, logger: import('pino').Logger }} params
 */
export function startMongoConnectionBackground({ mongoUri, logger }) {
  const meta = mongoUriMeta(mongoUri);
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  void (async function mongoRetryLoop() {
    while (true) {
      attempt += 1;
      try {
        if (mongoose.connection.readyState === 1) {
          logger.info({ ...meta, attempt }, 'mongodb_already_connected');
          return;
        }
        mongoose.set('strictQuery', true);
        await mongoose.connect(mongoUri);
        logger.info({ ...meta, attempt }, 'mongodb_connected');
        return;
      } catch (err) {
        logger.warn(
          { err, ...meta, attempt, mode: 'degraded' },
          'mongodb_connect_attempt_failed_will_retry',
        );
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
      }
    }
  })();
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
