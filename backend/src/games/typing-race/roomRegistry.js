import { TypingRaceRoom } from "./roomSession.js";
import { TYPING_RACE_ROOM_CODE_LEN } from "./constants.js";

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

  /**
   * @param {import('socket.io').Socket} socket
   */
  function leaveRoom(socket) {
    const code = socketToRoom.get(socket.id);
    if (!code) {
      return;
    }
    socketToRoom.delete(socket.id);
    socket.leave(code);
    const room = rooms.get(code);
    if (!room) {
      return;
    }
    room.removeSocket(socket);
    room.emitRoom();
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(code);
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
    if (replaced) {
      socketToRoom.delete(replaced);
    }
    socketToRoom.set(socket.id, code);
    room.emitRoom();
    return { room, code };
  }

  /**
   * @param {string} code
   * @param {import('socket.io').Socket} socket
   * @param {string} userId
   * @param {string} username
   */
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
    /** If we already belong to this room, do not leave first — leaveRoom would drop the lobby player and delete the room. */
    const alreadyInThisRoom = socketToRoom.get(socket.id) === digits;
    if (!alreadyInThisRoom) {
      leaveRoom(socket);
    }
    const replaced = room.addPlayer(userId, username, socket);
    if (replaced) {
      socketToRoom.delete(replaced);
    }
    socketToRoom.set(socket.id, digits);
    room.emitRoom();
    return room;
  }

  function shutdown() {
    for (const room of rooms.values()) {
      room.destroy();
    }
    rooms.clear();
    socketToRoom.clear();
  }

  return {
    rooms,
    socketToRoom,
    leaveRoom,
    getRoomForSocket,
    createRoom,
    joinRoom,
    shutdown,
  };
}
