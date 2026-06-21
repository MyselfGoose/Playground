/**
 * Site-wide presence: user is online while any browser tab holds a /social socket.
 */

/**
 * @returns {{
 *   addSocket: (userId: string, socketId: string) => boolean,
 *   removeSocket: (socketId: string) => { userId: string, wentOffline: boolean, lastSeenAt: string } | null,
 *   isOnline: (userId: string) => boolean,
 *   filterOnline: (userIds: string[]) => string[],
 *   getLastSeenAt: (userId: string) => string | null,
 * }}
 */
export function createPresenceRegistry() {
  /** @type {Map<string, Set<string>>} */
  const userToSockets = new Map();
  /** @type {Map<string, string>} */
  const socketToUser = new Map();
  /** @type {Map<string, string>} */
  const lastSeenAt = new Map();

  /**
   * @param {string} userId
   * @param {string} socketId
   * @returns {boolean} true if user just came online (first socket)
   */
  function addSocket(userId, socketId) {
    socketToUser.set(socketId, userId);
    const set = userToSockets.get(userId) ?? new Set();
    const wasOnline = set.size > 0;
    set.add(socketId);
    userToSockets.set(userId, set);
    lastSeenAt.delete(userId);
    return !wasOnline;
  }

  /**
   * @param {string} socketId
   */
  function removeSocket(socketId) {
    const userId = socketToUser.get(socketId);
    if (!userId) return null;
    socketToUser.delete(socketId);
    const set = userToSockets.get(userId);
    if (!set) return null;
    set.delete(socketId);
    if (set.size > 0) {
      return { userId, wentOffline: false, lastSeenAt: new Date().toISOString() };
    }
    userToSockets.delete(userId);
    const seen = new Date().toISOString();
    lastSeenAt.set(userId, seen);
    return { userId, wentOffline: true, lastSeenAt: seen };
  }

  /**
   * @param {string} userId
   */
  function isOnline(userId) {
    const set = userToSockets.get(userId);
    return Boolean(set && set.size > 0);
  }

  /**
   * @param {string[]} userIds
   * @returns {string[]}
   */
  function filterOnline(userIds) {
    return userIds.filter((id) => isOnline(id));
  }

  /**
   * @param {string} userId
   */
  function getLastSeenAt(userId) {
    return lastSeenAt.get(userId) ?? null;
  }

  function getOnlineCount() {
    return userToSockets.size;
  }

  return {
    addSocket,
    removeSocket,
    isOnline,
    filterOnline,
    getLastSeenAt,
    getOnlineCount,
  };
}
