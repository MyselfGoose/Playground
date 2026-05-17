/**
 * @param {unknown} raw
 * @returns {string}
 */
export function safeNextPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}
