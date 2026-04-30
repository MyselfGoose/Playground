import { z } from "zod";
import {
  tabooChangeTeamSchema,
  tabooCreateRoomSchema,
  tabooJoinRoomSchema,
  tabooReviewVoteSchema,
  tabooSetCategoriesSchema,
  tabooSetReadySchema,
  tabooSubmitGuessSchema,
} from "./schemas.js";

function deliverAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function toAckFailure(err) {
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: first ? `${first.path.join(".")}: ${first.message}` : "Validation failed",
      },
    };
  }
  return {
    ok: false,
    error: {
      code: err?.code ? String(err.code) : "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "Request failed",
    },
  };
}

function register(socket, logger, event, schema, handler) {
  socket.on(event, async (payload, ack) => {
    try {
      const data = schema ? schema.parse(payload ?? {}) : {};
      const result = await handler(data);
      deliverAck(ack, { ok: true, data: result ?? null });
    } catch (err) {
      const failure = toAckFailure(err);
      logger.warn({ err, event: `${event}_fail`, userId: socket.data.userId, socketId: socket.id, code: failure.error.code }, "taboo");
      deliverAck(ack, failure);
    }
  });
}

export function installTabooHandlers({ socket, registry, logger }) {
  register(socket, logger, "create_room", tabooCreateRoomSchema, async (data) => {
    const room = registry.createRoom(socket, socket.data.userId, socket.data.username, data);
    registry.emitRoom(room.code, "room_created");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "join_room", tabooJoinRoomSchema, async (data) => {
    const room = registry.joinRoom(data.code, socket, socket.data.userId, socket.data.username);
    registry.emitRoom(room.code, "member_joined");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "leave_room", null, async () => {
    const room = registry.getRoomForSocket(socket);
    const code = room?.code;
    registry.leaveRoom(socket, { hardLeave: true });
    if (code) registry.emitRoom(code, "member_left");
    return { left: true };
  });

  register(socket, logger, "set_ready", tabooSetReadySchema, async (data) => {
    const { room, started } = registry.setReady(socket, data.ready);
    registry.emitRoom(room.code, started ? "game_started" : "ready_changed");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "get_categories", null, async () => {
    return { categories: registry.listCategories() };
  });

  register(socket, logger, "get_room_state", null, async () => {
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "set_categories", tabooSetCategoriesSchema, async (data) => {
    const room = registry.setCategories(socket, data);
    registry.emitRoom(room.code, "categories_changed");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "change_team", tabooChangeTeamSchema, async (data) => {
    const room = registry.changeTeam(socket, data.team);
    registry.emitRoom(room.code, "team_changed");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "start_game", null, async () => {
    const room = registry.startGame(socket);
    registry.emitRoom(room.code, "game_started");
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "start_turn", null, async () => {
    const { room, reason } = registry.applyAction(socket, "start_turn", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "submit_guess", tabooSubmitGuessSchema, async (data) => {
    const { room, reason } = registry.applyAction(socket, "submit_guess", data);
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "skip_card", null, async () => {
    const { room, reason } = registry.applyAction(socket, "skip_card", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "taboo_called", null, async () => {
    const { room, reason } = registry.applyAction(socket, "taboo_called", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "request_review", null, async () => {
    const { room, reason } = registry.applyAction(socket, "request_review", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "dismiss_review", null, async () => {
    const { room, reason } = registry.applyAction(socket, "dismiss_review", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "review_vote", tabooReviewVoteSchema, async (data) => {
    const { room, reason } = registry.applyAction(socket, "review_vote", data);
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });

  register(socket, logger, "review_continue", null, async () => {
    const { room, reason } = registry.applyAction(socket, "review_continue", {});
    registry.emitRoom(room.code, reason);
    return { room: registry.snapshotFor(socket) };
  });
}
