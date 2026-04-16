import 'dotenv/config';
import { getEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createLogger } from './lib/logger.js';
import { createApp } from './app.js';
import { createHttpServer, listen, setupGracefulShutdown } from './server.js';
import { registerProcessHandlers } from './processHandlers.js';
import { attachSocketIo } from './games/npat/npatSocket.js';

async function main() {
  const env = getEnv();
  const logger = createLogger(env);

  registerProcessHandlers({ logger });

  await connectDb({ mongoUri: env.MONGO_URI, logger });

  const app = createApp({ env, logger });
  const server = createHttpServer(app);
  const { io, registry } = attachSocketIo({ server, env, logger });

  // Rehydrate any non-finished rooms from Mongo so mid-round games survive restarts.
  try {
    await registry.bootHydrate();
  } catch (err) {
    logger.error({ err, event: 'npat_boot_hydrate_error' }, 'npat_room');
  }

  // Periodic cleanup of very old waiting/finished rooms.
  const cleanupInterval = setInterval(() => {
    registry.cleanupStale().catch((err) => {
      logger.warn({ err, event: 'npat_cleanup_error' }, 'npat_room');
    });
  }, 5 * 60 * 1000);
  cleanupInterval.unref();

  setupGracefulShutdown({
    server,
    logger,
    beforeHttpClose: async () => {
      clearInterval(cleanupInterval);
      try {
        await registry.flushAll();
      } catch (err) {
        logger.warn({ err, event: 'npat_flush_error' }, 'npat_room');
      }
      await new Promise((resolve) => {
        io.close(() => resolve(undefined));
      });
    },
    onBeforeExit: () => disconnectDb({ logger }),
  });

  await listen(server, { port: env.PORT, host: '0.0.0.0', logger });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
