import { bumpMetric } from './observability/platformMetrics.js';

let registered = false;

/** Tracks process-level health degradation visible to `/health`. */
let degraded = false;
let lastUnhandledAt = 0;

export function isProcessDegraded() {
  return degraded;
}

export function getLastUnhandledAt() {
  return lastUnhandledAt;
}

/**
 * Logs process errors and marks the process as degraded instead of crashing.
 * `uncaughtException` still exits — those indicate truly unrecoverable states
 * (corrupted stack, synchronous throws in core paths). Unhandled rejections
 * are logged and surfaced via the health endpoint but do NOT crash the server,
 * preserving all in-memory game state.
 *
 * @param {{ logger: import('pino').Logger }} params
 */
export function registerProcessHandlers({ logger }) {
  if (registered) {
    return;
  }
  registered = true;

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled_rejection');
    bumpMetric('unhandled_rejection');
    degraded = true;
    lastUnhandledAt = Date.now();
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception');
    process.exit(1);
  });
}
