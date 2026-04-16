import pino from 'pino';

/** @param {import('../config/env.js').Env} env */
export function createLogger(env) {
  return pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    base: { service: 'games-platform-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.cookies.access_token',
        'req.cookies.refresh_token',
        'password',
        'req.body.password',
        'token',
        'accessToken',
        'refreshToken',
      ],
      remove: true,
    },
  });
}
