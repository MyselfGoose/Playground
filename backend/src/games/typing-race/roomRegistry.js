import { TypingRaceRoom } from "./roomSession.js";
import { TYPING_RACE_ROOM_CODE_LEN } from "./constants.js";
import { registerRoomAccessor } from "../../realtime/roomInviteRegistry.js";
import { onRoomDestroyed, onRoomGameStarted } from "../../realtime/roomInviteLifecycle.js";

const LOBBY_IDLE_TTL_MS = 15 * 60 * 1000;
const IDLE_CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * @param {number} len
 */
function randomDigits(len) {
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * @param {{
 *   typingNs: import('socket.io').Namespace,
 *   logger: import('pino').Logger,
 * }} params
 */
export function createTypingRaceRegistry({ typingNs, logger }) {
  /** @type {Map<string, TypingRaceRoom>} */
  const rooms = new Map();
  /** @type {Map<string, string>} */
  const socketToRoom = new Map();
  /** @type {Map<string, string>} userId -> roomCode */
  const userToRoom = new Map();

  /**
   * Remove a superseded socket from the room channel when the same user reconnects.
   * @param {string | null | undefined} replacedSocketId
   * @param {string} roomCode
   */
  function evictSupersededSocket(replacedSocketId, roomCode) {
    if (!replacedSocketId) return;
    socketToRoom.delete(replacedSocketId);
    const oldSock = typingNs.sockets.get(replacedSocketId);
    if (oldSock) {
      oldSock.leave(roomCode);
      oldSock.emit("typing_session_superseded", {
        reason: "reconnected_elsewhere",
        roomCode,
      });
    }
  }

  /**
   * @param {import('socket.io').Socket} socket
   */
  function leaveRoom(socket) {
    const code = socketToRoom.get(socket.id);
    if (!code) {
      return;
    }
    const userId = /** @type {string} */ (socket.data.userId);
    socketToRoom.delete(socket.id);
    socket.leave(code);
    const room = rooms.get(code);
    if (!room) {
      userToRoom.delete(userId);
      return;
    }
    room.removeSocket(socket, { hardLeave: true });
    if (!room.players.has(userId)) {
      userToRoom.delete(userId);
    }
    room.emitRoom();
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(code);
      onRoomDestroyed('typing-race', code);
    }
  }

  /**
   * Transport disconnect: keep lobby players in the in-memory room so
   * `joinRoom` after a new socket (same user) can reattach. Avoids
   * destroying the room on every brief disconnect during client navigation.
   * @param {import('socket.io').Socket} socket
   */
  function onSocketDisconnect(socket) {
    const code = socketToRoom.get(socket.id);
    if (!code) {
      return;
    }
    const userId = /** @type {string} */ (socket.data.userId);
    socketToRoom.delete(socket.id);
    socket.leave(code);
    const room = rooms.get(code);
    if (!room) {
      userToRoom.delete(userId);
      return;
    }
    room.removeSocket(socket, { hardLeave: false });
    room.emitRoom();
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(code);
      onRoomDestroyed('typing-race', code);
      userToRoom.delete(userId);
    }
  }

  /**
   * @param {import('socket.io').Socket} socket
   */
  function getRoomForSocket(socket) {
    const code = socketToRoom.get(socket.id);
    return code ? rooms.get(code) ?? null : null;
  }

  /**
   * @param {import('socket.io').Socket} socket
   * @param {string} userId
   * @param {string} username
   */
  function createRoom(socket, userId, username) {
    leaveRoom(socket);
    let code = "";
    for (let i = 0; i < 48; i++) {
      code = randomDigits(TYPING_RACE_ROOM_CODE_LEN);
      if (!rooms.has(code)) {
        break;
      }
    }
    if (!code || rooms.has(code)) {
      const err = new Error("Could not allocate room");
      /** @type {any} */ (err).code = "ROOM_ALLOC_FAIL";
      throw err;
    }
    const room = new TypingRaceRoom({ roomCode: code, typingNs, logger });
    rooms.set(code, room);
    const replaced = room.addPlayer(userId, username, socket);
    evictSupersededSocket(replaced, code);
    socketToRoom.set(socket.id, code);
    userToRoom.set(userId, code);
    room.emitRoom();
    return { room, code };
  }

  /**
   * @param {string} code
   * @param {import('socket.io').Socket} socket
   * @param {string} userId
   * @param {string} username
   */
  /**
   * Host removes a player from the lobby (hard leave + optional disconnected row).
   * @param {import('socket.io').Socket} socket
   * @param {string} targetUserId
   */
  function kickPlayer(socket, targetUserId) {
    const room = getRoomForSocket(socket);
    if (!room) {
      const err = new Error("Not in a room");
      /** @type {any} */ (err).code = "NOT_IN_ROOM";
      throw err;
    }
    const hostId = /** @type {string} */ (socket.data.userId);
    if (hostId !== room.hostUserId) {
      const err = new Error("Only host can kick");
      /** @type {any} */ (err).code = "FORBIDDEN";
      throw err;
    }
    if (room.phase !== "lobby") {
      const err = new Error("Can only kick in lobby");
      /** @type {any} */ (err).code = "BAD_PHASE";
      throw err;
    }
    if (targetUserId === hostId) {
      const err = new Error("Cannot kick yourself");
      /** @type {any} */ (err).code = "VALIDATION_ERROR";
      throw err;
    }
    if (!room.players.has(targetUserId)) {
      const err = new Error("Player not in room");
      /** @type {any} */ (err).code = "VALIDATION_ERROR";
      throw err;
    }

    const roomCode = room.roomCode;
    for (const [sid, code] of socketToRoom) {
      if (code !== roomCode) {
        continue;
      }
      const targetSocket = typingNs.sockets.get(sid);
      if (targetSocket?.data?.userId !== targetUserId) {
        continue;
      }
      socketToRoom.delete(sid);
      targetSocket.leave(roomCode);
      targetSocket.emit("typing_kicked", { roomCode });
      room.removeSocket(targetSocket, { hardLeave: true });
    }
    if (room.players.has(targetUserId)) {
      room.kickUser(targetUserId);
    }
    room.emitRoom();
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(roomCode);
      onRoomDestroyed('typing-race', roomCode);
    }
    return room;
  }

  function joinRoom(code, socket, userId, username) {
    const digits = String(code ?? "").replace(/\D/g, "");
    if (digits.length !== TYPING_RACE_ROOM_CODE_LEN) {
      const err = new Error("Invalid room code");
      /** @type {any} */ (err).code = "VALIDATION_ERROR";
      throw err;
    }
    const room = rooms.get(digits);
    if (!room) {
      const err = new Error("Room not found");
      /** @type {any} */ (err).code = "ROOM_NOT_FOUND";
      throw err;
    }
    if (room.phase !== "lobby") {
      const reconnecting = room.players.get(userId);
      if (!reconnecting) {
        const err = new Error("Race already started");
        /** @type {any} */ (err).code = "ROOM_LOCKED";
        throw err;
      }
    }
    const alreadyInThisRoom = socketToRoom.get(socket.id) === digits;
    if (!alreadyInThisRoom) {
      leaveRoom(socket);
    }
    const replaced = room.addPlayer(userId, username, socket);
    evictSupersededSocket(replaced, digits);
    socketToRoom.set(socket.id, digits);
    userToRoom.set(userId, digits);
    room.emitRoom();
    return room;
  }

  /** @type {ReturnType<typeof setInterval> | null} */
  let idleCleanupInterval = null;

  function startIdleCleanup() {
    if (idleCleanupInterval) return;
    idleCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [code, room] of rooms) {
        if (room.phase !== "lobby") continue;
        const allDisconnected = [...room.players.values()].every((p) => !p.connected);
        if (!allDisconnected) continue;
        if (now - room.lastActivityAt < LOBBY_IDLE_TTL_MS) continue;
        logger.info({ event: "typing_race_idle_cleanup", roomCode: code }, "typing_race");
        room.destroy();
        rooms.delete(code);
        onRoomDestroyed('typing-race', code);
        for (const [uid, rc] of userToRoom) {
          if (rc === code) userToRoom.delete(uid);
        }
      }
    }, IDLE_CLEANUP_INTERVAL_MS);
    idleCleanupInterval.unref?.();
  }

  startIdleCleanup();

  /**
   * Auto-attach a reconnecting socket to their existing room (if still active).
   * @param {import('socket.io').Socket} socket
   * @returns {TypingRaceRoom | null}
   */
  function attachActiveRoomForUser(socket) {
    const userId = /** @type {string} */ (socket.data.userId);
    const code = userToRoom.get(userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) {
      userToRoom.delete(userId);
      return null;
    }
    if (!room.players.has(userId)) {
      userToRoom.delete(userId);
      return null;
    }
    const username = /** @type {string} */ (socket.data.username);
    const replaced = room.addPlayer(userId, username, socket);
    evictSupersededSocket(replaced, code);
    socketToRoom.set(socket.id, code);
    socket.join(code);
    return room;
  }

  function shutdown() {
    if (idleCleanupInterval) {
      clearInterval(idleCleanupInterval);
      idleCleanupInterval = null;
    }
    for (const room of rooms.values()) {
      room.destroy();
    }
    rooms.clear();
    socketToRoom.clear();
    userToRoom.clear();
  }

  registerRoomAccessor('typing-race', {
    getInviteContext(rawCode) {
      const code = String(rawCode ?? '').replace(/\D/g, '').slice(0, TYPING_RACE_ROOM_CODE_LEN);
      const room = rooms.get(code);
      if (!room) {
        return { exists: false, hostId: null, playerUserIds: [], joinable: false };
      }
      return {
        exists: true,
        hostId: room.hostUserId ? String(room.hostUserId) : null,
        playerUserIds: [...room.players.keys()].map(String),
        joinable: room.phase === 'lobby',
      };
    },
  });

  return {
    rooms,
    socketToRoom,
    userToRoom,
    leaveRoom,
    onSocketDisconnect,
    getRoomForSocket,
    createRoom,
    joinRoom,
    kickPlayer,
    attachActiveRoomForUser,
    shutdown,
    getObservabilitySnapshot() {
      let roomCount = 0;
      let playerCount = 0;
      for (const room of rooms.values()) {
        roomCount += 1;
        playerCount += room.players?.size ?? 0;
      }
      return { game: 'typing-race', rooms: roomCount, players: playerCount };
    },
  };
}
