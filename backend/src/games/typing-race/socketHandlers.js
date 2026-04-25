import { z } from "zod";
import {
  typingJoinRoomSchema,
  typingProgressSchema,
  typingSetReadySchema,
} from "./validation/typingRace.schemas.js";
import { deliverAck, makeTypingRegister } from "./socketUtils.js";
import { persistTypingAttempt } from "../../services/leaderboardStatsService.js";

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

  const typingFinishSchema = z.object({
    stats: z.object({
      correctChars: z.number().int().min(0).max(100_000),
      incorrectChars: z.number().int().min(0).max(100_000),
      extraChars: z.number().int().min(0).max(100_000),
      wpm: z.number().min(0).max(500),
      rawWpm: z.number().min(0).max(500),
      elapsedMs: z.number().min(0).max(3_600_000),
    }).optional(),
  }).optional();

  register("typing_finish", {
    schema: typingFinishSchema,
    handler: async ({ data }) => {
      const room = requireRoom();
      const roomSnap = room.finishPlayer(userId);
      const player = roomSnap.players.find((p) => p.userId === userId);
      const stats = data?.stats;
      if (stats && player && room.raceConfig?.passage) {
        void persistTypingAttempt({
          userId,
          username,
          mode: 'multi',
          roomCode: room.roomCode,
          passageLength: room.raceConfig.passage.length,
          correctChars: stats.correctChars,
          incorrectChars: stats.incorrectChars,
          extraChars: stats.extraChars,
          wpm: stats.wpm,
          rawWpm: stats.rawWpm,
          elapsedMs: stats.elapsedMs,
          rank: player.rank ?? null,
          playerCount: roomSnap.players.length,
          dnf: false,
        }, logger);
      }
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

  const soloCompleteSchema = z.object({
    passageLength: z.number().int().min(1).max(100_000),
    correctChars: z.number().int().min(0).max(100_000),
    incorrectChars: z.number().int().min(0).max(100_000),
    extraChars: z.number().int().min(0).max(100_000),
    wpm: z.number().min(0).max(500),
    rawWpm: z.number().min(0).max(500),
    elapsedMs: z.number().min(1).max(3_600_000),
  });

  register("typing_solo_complete", {
    schema: soloCompleteSchema,
    handler: async ({ data }) => {
      void persistTypingAttempt({
        userId,
        username,
        mode: 'solo',
        passageLength: data.passageLength,
        correctChars: data.correctChars,
        incorrectChars: data.incorrectChars,
        extraChars: data.extraChars,
        wpm: data.wpm,
        rawWpm: data.rawWpm,
        elapsedMs: data.elapsedMs,
        rank: null,
        playerCount: 1,
        dnf: false,
      }, logger);
      return { ok: true };
    },
  });
}
