export class AppError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{
   *   code?: string,
   *   expose?: boolean,
   *   category?: string,
   *   recoverable?: boolean,
   *   retryable?: boolean,
   *   requires_reauth?: boolean,
   *   user_message?: string,
   * }} [opts]
   */
  constructor(statusCode, message, opts = {}) {
    const { code, expose = true, category, recoverable, retryable, requires_reauth, user_message } = opts;
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
    /** @type {string|undefined} */
    this.category = category;
    /** @type {boolean|undefined} */
    this.recoverable = recoverable;
    /** @type {boolean|undefined} */
    this.retryable = retryable;
    /** @type {boolean|undefined} */
    this.requires_reauth = requires_reauth;
    /** @type {string|undefined} */
    this.user_message = user_message;
  }
}
