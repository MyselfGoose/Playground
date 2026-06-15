/**
 * Evict superseded party-game sockets when the same user reconnects on a new tab.
 *
 * @param {import('socket.io').Namespace} ns
 * @param {{
 *   userId: string,
 *   currentSocketId: string,
 *   roomCode: string,
 *   socketToCode: Map<string, string>,
 *   room: { socketIds: Set<string> },
 *   userToSocketIds: Map<string, Set<string>>,
 *   eventName?: string,
 * }} ctx
 * @returns {string[]} evicted socket ids
 */
export function evictSupersededPartySockets(ns, ctx) {
  const { userId, currentSocketId, roomCode, socketToCode, room, userToSocketIds } = ctx;
  const eventName = ctx.eventName ?? "party_session_superseded";
  const set = userToSocketIds.get(userId);
  if (!set) return [];

  /** @type {string[]} */
  const evicted = [];
  for (const sid of [...set]) {
    if (sid === currentSocketId) continue;
    socketToCode.delete(sid);
    room.socketIds.delete(sid);
    const oldSock = ns.sockets.get(sid);
    if (oldSock) {
      oldSock.leave(roomCode);
      oldSock.emit(eventName, { reason: "reconnected_elsewhere", roomCode });
    }
    set.delete(sid);
    evicted.push(sid);
  }
  return evicted;
}
