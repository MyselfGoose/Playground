/**
 * @param {unknown} raw
 * @returns {string} digits only
 */
export function stripRoomDigits(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\D/g, '');
}

/**
 * @param {string} digits
 * @param {number} len
 * @returns {string} same digits if valid
 */
export function assertRoomCodeDigits(digits, len) {
  if (!/^\d+$/.test(digits) || digits.length !== len) {
    const err = new Error(`Room code must be exactly ${len} digits`);
    /** @type {any} */ (err).code = 'VALIDATION_ERROR';
    throw err;
  }
  return digits;
}
