export class AppError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, expose?: boolean }} [opts]
   */
  constructor(statusCode, message, { code, expose = true } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
  }
}
