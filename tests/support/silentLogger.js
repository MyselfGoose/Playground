import pino from 'pino';

/** Real Pino instance at silent level — required for `pino-http` middleware in `createApp`. */
export function createSilentLogger() {
  return pino({ level: 'silent' });
}
