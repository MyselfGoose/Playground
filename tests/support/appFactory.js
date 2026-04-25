import { createApp } from '../../backend/src/app.js';
import { createSilentLogger } from './silentLogger.js';

/**
 * Build Express app for supertest (no listen, no Socket.IO).
 *
 * @param {{ env: import('../../backend/src/config/env.js').Env, logger?: import('pino').Logger }} params
 */
export function createTestApp({ env, logger }) {
  return createApp({ env, logger: logger ?? createSilentLogger() });
}
