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
  OAUTH_ONLY_ACCOUNT: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'This account uses Google sign-in. Continue with Google instead.',
  },
  GOOGLE_EMAIL_UNVERIFIED: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'Your Google email must be verified before signing in.',
  },
  GOOGLE_ACCOUNT_CONFLICT: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'This Google account cannot be linked. Contact support if you need help.',
  },
  GOOGLE_OAUTH_DISABLED: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'Google sign-in is not available right now.',
  },
  OAUTH_TICKET_INVALID: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'Your sign-in link expired. Please try Google sign-in again.',
  },
  OAUTH_STATE_INVALID: {
    category: 'AUTH',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'Sign-in could not be completed. Please try again.',
  },
  GOOGLE_OAUTH_FAILED: {
    category: 'AUTH',
    recoverable: true,
    retryable: true,
    requires_reauth: false,
    user_message: 'Google sign-in failed. Please try again.',
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
  LOBBY_FULL: {
    category: 'GAME',
    recoverable: false,
    retryable: false,
    requires_reauth: false,
    user_message: 'This lobby is full. Ask the host or wait for a spot.',
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
