import http from 'node:http';
import { createTestApp } from './appFactory.js';
import { createSilentLogger } from './silentLogger.js';
import { attachSocketIo } from '../../backend/src/realtime/socketServer.js';

/**
 * HTTP server + Express app + Socket.IO (same wiring as production).
 *
 * @param {import('../../backend/src/config/env.js').Env} env
 */
export async function startSocketTestStack(env) {
  const logger = createSilentLogger();
  const app = createTestApp({ env, logger });
  const server = http.createServer(app);
  const { io, registry } = await attachSocketIo({ server, env, logger });
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
        const sockets = await io.fetchSockets();
        await Promise.all(
          sockets.map(
            (s) =>
              new Promise((resolve) => {
                s.once('disconnect', () => resolve(undefined));
                s.disconnect(true);
              }),
          ),
        );
      } catch {
        /* ignore */
      }
      try {
        if (registry?.flushAll) {
          await registry.flushAll();
        }
      } catch {
        /* ignore */
      }
      // NPAT persist is fire-and-forget; brief settle before Mongo teardown in tests.
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve(undefined)));
      });
    },
  };
}
