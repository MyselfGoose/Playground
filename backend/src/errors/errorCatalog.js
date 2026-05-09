/**
 * Unified API error metadata (plan section E).
 * Codes without an entry fall back via `defaultMetaForStatus`.
 */

/** @typedef {'AUTH'|'NETWORK'|'GAME'|'DB'|'SOCKET'|'VALIDATION'|'RATE_LIMIT'} ErrorCategory */

/** @type {Record<string, { category: ErrorCategory, recoverable: boolean, retryable: boolean, requires_reauth: boolean, user_message: string }>} */
export const ERROR_CODE_META = {
  UNAUTHENTICATED: {
    category: 'AUTH',
    recoverable: true,
    retryable: false,
    requires_reauth: true,
    user_message: 'Please sign in to continue.',
  },
  SESSION_REVOKED: {
    category: 'AUTH',
    recoverable: true,
    retryable: false,
    requires_reauth: true,
    user_message: 'Your session ended. Please sign in again.',
  },
  INVALID_CREDENTIALS: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: true,
    user_message: 'Invalid credentials.',
  },
  INVALID_REFRESH: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: true,
    user_message: 'Your session expired. Please sign in again.',
  },
  SESSION_EXPIRED: {
    category: 'AUTH',
    recoverable: true,
    retryable: false,
    requires_reauth: true,
    user_message: 'Your session expired. Please sign in again.',
  },
  TOKEN_REUSE: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: true,
    user_message: 'Your session was reset for security. Please sign in again.',
  },
  INVALID_TOKEN: {
    category: 'AUTH',
    recoverable: true,
    retryable: false,
    requires_reauth: true,
    user_message: 'Authentication failed. Please sign in again.',
  },
  USER_NOT_FOUND: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'User not found.',
  },
  USER_INACTIVE: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: true,
    user_message: 'This account is inactive.',
  },
  FORBIDDEN: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'You do not have permission to do that.',
  },
  DB_UNAVAILABLE: {
    category: 'DB',
    recoverable: true,
    retryable: true,
    requires_reauth: false,
    user_message: 'Database is temporarily unavailable. Try again shortly.',
  },
};

/**
 * @param {number} statusCode
 * @param {string} message
 */
export function defaultMetaForStatus(statusCode, message) {
  if (statusCode === 429) {
    return {
      category: /** @type {ErrorCategory} */ ('RATE_LIMIT'),
      recoverable: true,
      retryable: true,
      requires_reauth: false,
      user_message: 'Too many requests. Please wait and try again.',
    };
  }
  if (statusCode >= 500) {
    return {
      category: /** @type {ErrorCategory} */ ('DB'),
      recoverable: true,
      retryable: true,
      requires_reauth: false,
      user_message: 'Something went wrong on our side. Please try again.',
    };
  }
  return {
    category: /** @type {ErrorCategory} */ ('GAME'),
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: message || 'Request failed.',
  };
}

/**
 * @param {{ code?: string, statusCode?: number, message?: string }} err
 */
export function metaForError(err) {
  const code = err.code && typeof err.code === 'string' ? err.code : '';
  if (code && ERROR_CODE_META[code]) {
    return { ...ERROR_CODE_META[code] };
  }
  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
  return defaultMetaForStatus(status, err.message || 'Request failed.');
}
