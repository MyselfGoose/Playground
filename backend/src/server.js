import http from 'node:http';

/**
 * @param {import('express').Express} app
 */
export function createHttpServer(app) {
  return http.createServer(app);
}

/**
 * @param {import('node:http').Server} server
 * @param {{ port: number, host: string, logger: import('pino').Logger }} opts
 */
export async function listen(server, { port, host, logger }) {
  await new Promise((resolve, reject) => {
    function onErr(err) {
      reject(err);
    }
    server.once('error', onErr);
    server.listen(port, host, () => {
      server.off('error', onErr);
      resolve();
    });
  });
  logger.info({ port, host }, 'server_listening');
}

/**
 * @param {{
 *   server: import('node:http').Server,
 *   logger: import('pino').Logger,
 *   timeoutMs?: number,
 *   onBeforeExit?: () => Promise<void>,
 *   beforeHttpClose?: () => Promise<void>,
 * }} params
 */
export function setupGracefulShutdown({
  server,
  logger,
  timeoutMs = 10_000,
  onBeforeExit,
  beforeHttpClose,
}) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'shutdown_started');

    const force = setTimeout(() => {
      logger.error('shutdown_timeout_forcing_exit');
      process.exit(1);
    }, timeoutMs);

    if (beforeHttpClose) {
      try {
        await beforeHttpClose();
      } catch (err) {
        logger.error({ err }, 'shutdown_beforeHttpClose_error');
      }
    }

    await new Promise((resolve) => {
      server.close((err) => {
        clearTimeout(force);
        if (err) {
          logger.error({ err }, 'shutdown_http_close_error');
        } else {
          logger.info('shutdown_http_closed');
        }
        resolve();
      });
    });

    if (onBeforeExit) {
      try {
        await onBeforeExit();
      } catch (err) {
        logger.error({ err }, 'shutdown_onBeforeExit_error');
      }
    }

    process.exit(0);
  }

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      void shutdown(sig);
    });
  }
}
