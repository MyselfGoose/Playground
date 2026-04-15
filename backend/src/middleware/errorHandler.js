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

    const status = Number(err.status ?? err.statusCode);
    const resolvedStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;

    const exposeMessage =
      resolvedStatus < 500 || env.NODE_ENV !== 'production';

    const body = {
      error: {
        message: exposeMessage ? err.message : 'Internal Server Error',
        requestId: req.id,
      },
    };

    if (env.NODE_ENV === 'development' && err.stack) {
      body.error.stack = err.stack;
    }

    res.status(resolvedStatus).json(body);
  };
}
