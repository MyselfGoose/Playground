import http from 'node:http';
import { createTestApp } from './appFactory.js';
import { createSilentLogger } from './silentLogger.js';
import { attachSocketIo } from '../../backend/src/games/npat/npatSocket.js';

/**
 * HTTP server + Express app + Socket.IO (same wiring as production).
 *
 * @param {import('../../backend/src/config/env.js').Env} env
 */
export async function startSocketTestStack(env) {
  const logger = createSilentLogger();
  const app = createTestApp({ env, logger });
  const server = http.createServer(app);
  const { io } = attachSocketIo({ server, env, logger });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(undefined);
    });
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    io,
    baseUrl,
    async stop() {
      try {
        io.disconnectSockets(true);
      } catch {
        /* ignore */
      }
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve(undefined)));
      });
    },
  };
}
