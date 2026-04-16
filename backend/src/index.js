import 'dotenv/config';
import { getEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createLogger } from './lib/logger.js';
import { createApp } from './app.js';
import { createHttpServer, listen, setupGracefulShutdown } from './server.js';
import { registerProcessHandlers } from './processHandlers.js';

async function main() {
  const env = getEnv();
  const logger = createLogger(env);

  registerProcessHandlers({ logger });

  await connectDb({ mongoUri: env.MONGO_URI, logger });

  const app = createApp({ env, logger });
  const server = createHttpServer(app);

  setupGracefulShutdown({
    server,
    logger,
    onBeforeExit: () => disconnectDb({ logger }),
  });

  await listen(server, { port: env.PORT, host: '0.0.0.0', logger });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
