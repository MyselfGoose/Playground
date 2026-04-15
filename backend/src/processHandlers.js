let registered = false;

/**
 * Fail-fast policy for unrecoverable process errors (log then exit).
 * @param {{ logger: import('pino').Logger }} params
 */
export function registerProcessHandlers({ logger }) {
  if (registered) {
    return;
  }
  registered = true;

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled_rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception');
    process.exit(1);
  });
}
