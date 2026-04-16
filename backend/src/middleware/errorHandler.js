import { AppError } from '../errors/AppError.js';

/**
 * Central error boundary: log full detail, return safe JSON to clients.
 * @param {import('../config/env.js').Env} env
 */
export function createErrorHandler(env) {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (req.log) {
      req.log.error({ err, requestId: req.id }, 'request_failed');
    } else {
      console.error({ err, requestId: req.id }, 'request_failed');
    }

    const isApp = err instanceof AppError;
    const fromStatus = Number(err.status ?? err.statusCode);
    const fromApp = isApp && typeof err.statusCode === 'number' ? err.statusCode : undefined;
    const candidate = Number.isFinite(fromApp) ? fromApp : fromStatus;
    const resolvedStatus =
      Number.isFinite(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;

    const exposeMessage =
      resolvedStatus < 500 || env.NODE_ENV !== 'production';

    const body = {
      error: {
        message:
          exposeMessage && (!isApp || err.expose !== false) ? err.message : 'Internal Server Error',
        requestId: req.id,
      },
    };

    if (isApp && err.code && err.expose !== false) {
      body.error.code = err.code;
    }

    if (env.NODE_ENV === 'development' && err.stack) {
      body.error.stack = err.stack;
    }

    res.status(resolvedStatus).json(body);
  };
}
