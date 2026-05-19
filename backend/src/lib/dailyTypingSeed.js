/**
 * Deterministic daily typing challenge seed from UTC date (YYYY-MM-DD).
 * @param {string} [dateStr]
 */
export function utcDateString(dateStr) {
  if (dateStr) return dateStr;
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string} dateStr
 * @returns {number}
 */
export function dailyTypingSeedFromDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i += 1) {
    hash = Math.imul(31, hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = hash >>> 0;
  return seed === 0 ? 1 : seed;
}
