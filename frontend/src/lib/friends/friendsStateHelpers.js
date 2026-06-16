/**
 * Pure helpers for friends list state updates (socket + optimistic flows).
 */

/**
 * @param {Array<{ userId: string, online?: boolean, lastSeenAt?: string | null }>} friends
 * @param {string} userId
 * @param {boolean} online
 * @param {string | null} [lastSeenAt]
 */
export function setFriendOnlineState(friends, userId, online, lastSeenAt = null) {
  return friends.map((f) =>
    f.userId === userId ? { ...f, online, lastSeenAt: online ? null : lastSeenAt } : f,
  );
}

/**
 * @param {Array<{ userId: string }>} friends
 * @param {string} userId
 */
export function removeFriendById(friends, userId) {
  return friends.filter((f) => f.userId !== userId);
}

/**
 * @param {Array<{ userId: string }>} friends
 * @param {object} friend
 */
export function upsertFriend(friends, friend) {
  const idx = friends.findIndex((f) => f.userId === friend.userId);
  if (idx === -1) return [...friends, friend];
  const next = [...friends];
  next[idx] = { ...next[idx], ...friend };
  return next;
}

/**
 * @param {Array<{ userId: string, online?: boolean }>} friends
 */
export function countOnlineFriends(friends) {
  return friends.filter((f) => f.online).length;
}

/**
 * @param {'online'|'all'|'pending'} tab
 * @param {{
 *   friends: Array<{ userId: string, online?: boolean }>,
 *   pendingReceived: unknown[],
 *   pendingSent: unknown[],
 * }} state
 */
export function friendsForTab(tab, state) {
  if (tab === 'online') return state.friends.filter((f) => f.online);
  if (tab === 'pending') return [];
  return state.friends;
}
