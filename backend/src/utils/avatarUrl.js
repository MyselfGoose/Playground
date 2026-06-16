/**
 * @param {string | null | undefined} username
 * @returns {string}
 */
export function avatarUrlForUsername(username) {
  const seed = encodeURIComponent(username || 'player');
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`;
}
