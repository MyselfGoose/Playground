/**
 * Sanitize a display name into a valid username base (matches deriveUsername.js).
 * @param {string} raw
 */
export function suggestUsernameFromDisplayName(raw) {
  const base = String(raw || 'player')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (base.length >= 3) return base.slice(0, 32);
  return 'player';
}
