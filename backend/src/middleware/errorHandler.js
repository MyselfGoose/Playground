import { AppError } from '../errors/AppError.js';
import { defaultMetaForStatus, metaForError } from '../errors/errorCatalog.js';

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

    const catalogMeta = isApp
      ? metaForError({
          code: typeof err.code === 'string' ? err.code : '',
          statusCode: resolvedStatus,
          message: err.message,
        })
      : defaultMetaForStatus(resolvedStatus, err instanceof Error ? err.message : 'Request failed');

    /** @type {Record<string, unknown>} */
    const unified = {
      category:
        isApp && typeof err.category === 'string' && err.category ? err.category : catalogMeta.category,
      recoverable:
        typeof err.recoverable === 'boolean' ? err.recoverable : catalogMeta.recoverable,
      retryable: typeof err.retryable === 'boolean' ? err.retryable : catalogMeta.retryable,
      requires_reauth:
        typeof err.requires_reauth === 'boolean' ? err.requires_reauth : catalogMeta.requires_reauth,
      user_message:
        isApp && typeof err.user_message === 'string' && err.user_message
          ? err.user_message
          : catalogMeta.user_message,
    };

    const safeMsg =
      exposeMessage && (!isApp || err.expose !== false) ? err.message : 'Internal Server Error';

    const body = {
      error: {
        message: safeMsg,
        ...unified,
        requestId: req.id,
      },
    };

    if (isApp && err.code && err.expose !== false) {
      body.error.code = err.code;
    }
    if (!body.error.code) {
      body.error.code =
        resolvedStatus === 429 ? 'RATE_LIMIT' : resolvedStatus >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
    }

    if (env.NODE_ENV === 'development' && err.stack) {
      body.error.stack = err.stack;
    }

    res.status(resolvedStatus).json(body);
  };
}
