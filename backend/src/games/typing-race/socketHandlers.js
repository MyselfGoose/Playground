import {
  typingJoinRoomSchema,
  typingProgressSchema,
  typingSetReadySchema,
} from "./validation/typingRace.schemas.js";
import { deliverAck, makeTypingRegister } from "./socketUtils.js";

/**
 * @param {{
 *   socket: import('socket.io').Socket,
 *   registry: ReturnType<import('./roomRegistry.js').createTypingRaceRegistry>,
 *   logger: import('pino').Logger,
 * }} params
 */
export function installTypingRaceHandlers({ socket, registry, logger }) {
  const userId = /** @type {string} */ (socket.data.userId);
  const username = /** @type {string} */ (socket.data.username);

  /** @type {Record<string, number>} */
  const rateState = {};
  const register = makeTypingRegister({ socket, logger, userId, username, rateState });

  function requireRoom() {
    const room = registry.getRoomForSocket(socket);
    if (!room) {
      const err = new Error("Not in a room");
      /** @type {any} */ (err).code = "NOT_IN_ROOM";
      throw err;
    }
    return room;
  }

  register("typing_create_room", {
    handler: async () => {
      registry.leaveRoom(socket);
      const { room, code } = registry.createRoom(socket, userId, username);
      return { room: room.toPublicSnapshot(), roomCode: code };
    },
  });

  register("typing_join_room", {
    schema: typingJoinRoomSchema,
    handler: async ({ data }) => {
      const room = registry.joinRoom(data.roomCode, socket, userId, username);
      return { room: room.toPublicSnapshot() };
    },
  });

  register("typing_leave_room", {
    handler: async () => {
      registry.leaveRoom(socket);
      return { left: true };
    },
  });

  register("typing_set_ready", {
    schema: typingSetReadySchema,
    handler: async ({ data }) => {
      const room = requireRoom();
      room.setReady(userId, data.ready);
      room.emitRoom();
      return { room: room.toPublicSnapshot() };
    },
  });

  register("typing_start_countdown", {
    handler: async () => {
      const room = requireRoom();
      room.startCountdown(userId);
      return { room: room.toPublicSnapshot() };
    },
  });

  register("typing_progress_update", {
    schema: typingProgressSchema,
    rateLimit: { key: "progress", intervalMs: 45 },
    handler: async ({ data }) => {
      const room = requireRoom();
      room.applyProgress(userId, data);
      return {};
    },
  });

  register("typing_finish", {
    handler: async () => {
      const room = requireRoom();
      const roomSnap = room.finishPlayer(userId);
      return { room: roomSnap };
    },
  });

  register("typing_force_end", {
    handler: async () => {
      const room = requireRoom();
      room.forceEnd(userId);
      return { room: room.toPublicSnapshot() };
    },
  });

  register("typing_reset_lobby", {
    handler: async () => {
      const room = requireRoom();
      room.resetLobby(userId);
      return { room: room.toPublicSnapshot() };
    },
  });
}
