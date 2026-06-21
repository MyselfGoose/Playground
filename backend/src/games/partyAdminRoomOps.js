/**
 * Shared admin force-close / kick for party-style room managers.
 * @param {{
 *   game: string,
 *   code: string,
 *   rooms: Map<string, any>,
 *   socketToCode: Map<string, string>,
 *   userToCode: Map<string, string>,
 *   userToSocketIds?: Map<string, Set<string>>,
 *   ns: import('socket.io').Namespace,
 *   onDestroyed: (game: string, code: string) => void,
 *   disconnectGrace?: { clearGrace: (userId: string) => void },
 * }} params
 */
export function adminForceClosePartyRoom({
  game,
  code,
  rooms,
  socketToCode,
  userToCode,
  userToSocketIds,
  ns,
  onDestroyed,
  disconnectGrace,
}) {
  const room = rooms.get(code);
  if (!room) {
    const err = new Error('Room not found');
    /** @type {any} */ (err).code = 'ROOM_NOT_FOUND';
    throw err;
  }
  for (const socketId of room.socketIds ?? []) {
    const sock = ns.sockets.get(socketId);
    if (sock) {
      sock.emit('admin_room_closed', { roomCode: code, reason: 'admin' });
      sock.leave(code);
    }
    socketToCode.delete(socketId);
  }
  for (const p of room.players ?? []) {
    disconnectGrace?.clearGrace(p.userId);
    userToCode.delete(p.userId);
    userToSocketIds?.delete(p.userId);
  }
  rooms.delete(code);
  onDestroyed(game, code);
  return { ok: true, code };
}

/**
 * @param {{
 *   code: string,
 *   targetUserId: string,
 *   rooms: Map<string, any>,
 *   socketToCode: Map<string, string>,
 *   userToCode: Map<string, string>,
 *   userToSocketIds?: Map<string, Set<string>>,
 *   ns: import('socket.io').Namespace,
 *   onDestroyed: (game: string, code: string) => void,
 *   disconnectGrace?: { clearGrace: (userId: string) => void },
 *   game: string,
 * }} params
 */
export function adminKickPartyPlayer({
  code,
  targetUserId,
  rooms,
  socketToCode,
  userToCode,
  userToSocketIds,
  ns,
  onDestroyed,
  disconnectGrace,
  game,
}) {
  const room = rooms.get(code);
  if (!room) {
    const err = new Error('Room not found');
    /** @type {any} */ (err).code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = room.players?.find((/** @type {any} */ p) => p.userId === targetUserId);
  if (!player) {
    const err = new Error('Player not in room');
    /** @type {any} */ (err).code = 'VALIDATION_ERROR';
    throw err;
  }
  for (const socketId of room.socketIds ?? []) {
    const sock = ns.sockets.get(socketId);
    if (sock?.data?.userId !== targetUserId) continue;
    sock.emit('admin_kicked', { roomCode: code });
    sock.leave(code);
    socketToCode.delete(socketId);
    room.socketIds.delete(socketId);
    const set = userToSocketIds?.get(targetUserId);
    set?.delete(socketId);
    if (set && !set.size) userToSocketIds?.delete(targetUserId);
  }
  disconnectGrace?.clearGrace(targetUserId);
  room.players = room.players.filter((/** @type {any} */ p) => p.userId !== targetUserId);
  userToCode.delete(targetUserId);
  if (room.hostId === targetUserId && room.players.length) {
    room.hostId = room.players[0].userId;
  }
  if (!room.players.length) {
    rooms.delete(code);
    onDestroyed(game, code);
  }
  return { ok: true };
}
