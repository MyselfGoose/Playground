import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

/** Always load `backend/.env` — `import 'dotenv/config'` only reads CWD and misses the key if Node was started outside `backend/`. */
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
import { getEnv, EnvValidationError } from './config/env.js';
import { disconnectDb, startMongoConnectionBackground } from './config/db.js';
import { createLogger } from './lib/logger.js';
import { createApp } from './app.js';
import { createHttpServer, listen, setupGracefulShutdown } from './server.js';
import { registerProcessHandlers } from './processHandlers.js';
import { attachSocketIo } from './games/npat/npatSocket.js';
import { createMinimalListenApp } from './bootstrap/minimalListenApp.js';
import { scheduleLeaderboardCron } from './jobs/leaderboardCron.js';
import { runGeminiHealthCheck } from './services/npat/npatGeminiHealth.js';

if (globalThis.__server_started) {
  console.error('[boot] FATAL: index.js executed more than once — aborting duplicate start');
  process.exit(1);
}
globalThis.__server_started = true;

function bootTrace(msg, extra = {}) {
  console.log(`[boot] ${msg}`, Object.keys(extra).length ? JSON.stringify(extra) : '');
}

/** @param {unknown} registry */
function scheduleNpatBootHydrateWhenMongoReady(registry, logger) {
  const run = () => {
    void registry.bootHydrate().catch((err) => {
      logger.error({ err, event: 'npat_boot_hydrate_error' }, 'npat_room');
    });
  };
  if (mongoose.connection.readyState === 1) {
    run();
  } else {
    mongoose.connection.once('connected', run);
  }
}

/**
 * Env invalid: still listen so Railway proxy is never "connection refused".
 */
async function startMinimalHttpServer(envErr) {
  const flatten = envErr instanceof EnvValidationError ? envErr.flatten : undefined;
  const port = Number(process.env.PORT) || 4000;
  bootTrace('ENV_INVALID_STARTING_MINIMAL_HTTP', { port });

  const logger = createLogger({ NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'development' });
  registerProcessHandlers({ logger });
  logger.error(
    { err: envErr, flatten },
    'boot_env_validation_failed_minimal_server_only_fix_env_and_redeploy',
  );

  const app = createMinimalListenApp({ flatten });
  const server = createHttpServer(app);

  setupGracefulShutdown({
    server,
    logger,
    beforeHttpClose: async () => {},
    onBeforeExit: async () => {},
  });

  bootTrace('BEFORE_LISTEN_MINIMAL', { port, host: '0.0.0.0' });
  await listen(server, { port, host: '0.0.0.0', logger });
  logger.info({ port, host: '0.0.0.0' }, 'server_listening');
  logger.info('SERVER_BOOT_COMPLETE');
  console.log('[boot] SERVER_BOOT_COMPLETE (minimal)');
}

async function main() {
  bootTrace('TRACE_START');

  let env;
  try {
    bootTrace('TRACE_BEFORE_ENV');
    env = getEnv();
    bootTrace('TRACE_AFTER_ENV_OK');
  } catch (e) {
    bootTrace('TRACE_ENV_FAILED', { name: e?.name, message: e?.message });
    await startMinimalHttpServer(e);
    return;
  }

  const logger = createLogger(env);
  registerProcessHandlers({ logger });

  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      trustProxy: env.TRUST_PROXY,
      corsOrigin: env.CORS_ORIGIN,
      corsOriginCount: env.CORS_ORIGIN.split(',').filter((s) => s.trim()).length,
      cookieSecure: env.COOKIE_SECURE,
      cookieSameSite: env.COOKIE_SAME_SITE,
      cookieDomain: env.COOKIE_DOMAIN ?? '(unset)',
      gemini: Boolean(env.GEMINI_API_KEY),
    },
    'boot_config',
  );

  // Gemini readiness is non-fatal: mark degraded via health state if probe fails.
  const aiProbe = await runGeminiHealthCheck();
  if (!aiProbe.ok) {
    logger.warn({ aiProbe, mode: 'degraded' }, 'gemini_health_check_failed_boot_continues');
  } else {
    logger.info({ aiProbe }, 'gemini_health_check_ok');
  }

  bootTrace('TRACE_BEFORE_DB_BACKGROUND');
  startMongoConnectionBackground({ mongoUri: env.MONGO_URI, logger });
  logger.warn(
    { mode: 'degraded_until_mongo' },
    'mongodb_connection_started_in_background_server_not_blocked',
  );
  bootTrace('TRACE_AFTER_DB_SCHEDULED');

  bootTrace('TRACE_BEFORE_CREATE_APP');
  const app = createApp({ env, logger });
  const server = createHttpServer(app);
  bootTrace('TRACE_AFTER_CREATE_APP');

  bootTrace('TRACE_BEFORE_SOCKET_IO');
  const { io, registry, typingRaceRegistry, tabooRuntime, cahRuntime } = attachSocketIo({ server, env, logger });
  bootTrace('TRACE_AFTER_SOCKET_IO');

  scheduleNpatBootHydrateWhenMongoReady(registry, logger);

  const cleanupInterval = setInterval(() => {
    registry.cleanupStale().catch((err) => {
      logger.warn({ err, event: 'npat_cleanup_error' }, 'npat_room');
    });
  }, 5 * 60 * 1000);
  cleanupInterval.unref();

  const leaderboardCronInterval = scheduleLeaderboardCron(logger);

  setupGracefulShutdown({
    server,
    logger,
    beforeHttpClose: async () => {
      clearInterval(cleanupInterval);
      clearInterval(leaderboardCronInterval);
      try {
        typingRaceRegistry.shutdown();
      } catch (err) {
        logger.warn({ err, event: 'typing_race_shutdown_error' }, 'typing_race');
      }
      try {
        tabooRuntime.close();
      } catch (err) {
        logger.warn({ err, event: 'taboo_shutdown_error' }, 'taboo');
      }
      try {
        cahRuntime.close();
      } catch (err) {
        logger.warn({ err, event: 'cah_shutdown_error' }, 'cah');
      }
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

  const listenPort = env.PORT;
  bootTrace('TRACE_BEFORE_LISTEN', { port: listenPort, host: '0.0.0.0', rawPortEnv: process.env.PORT });
  if (String(listenPort) !== String(process.env.PORT)) {
    logger.warn(
      { listenPort, rawPortEnv: process.env.PORT },
      'PORT_MISMATCH_resolved_port_differs_from_process_env_PORT_check_Railway_variables',
    );
  }
  await listen(server, { port: listenPort, host: '0.0.0.0', logger });
  logger.info({ port: listenPort, host: '0.0.0.0' }, 'server_listening');
  logger.info('SERVER_BOOT_COMPLETE');
  console.log('[boot] SERVER_BOOT_COMPLETE');
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[bootstrap] Fatal — unexpected error before listen could complete:', msg);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
