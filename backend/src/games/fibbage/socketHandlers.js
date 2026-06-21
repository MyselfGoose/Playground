import { z } from 'zod';
import { userRepository } from '../../repositories/userRepository.js';
import { refreshSocketAvatarFromDb } from '../../utils/lobbyPlayerAvatar.js';
import { assertRoomCreationAllowed } from '../../utils/gameAvailability.js';
import {
  fibbageCreateRoomSchema,
  fibbageJoinRoomSchema,
  fibbageSetReadySchema,
  fibbageUpdateSettingsSchema,
  fibbageSubmitLieSchema,
  fibbageCastVoteSchema,
} from './schemas.js';

function deliverAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function toAckFailure(err) {
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    const fieldPath = first?.path?.length ? first.path.join('.') : '';
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: first ? (fieldPath ? `${fieldPath}: ${first.message}` : first.message) : 'Validation failed',
      },
    };
  }
  return {
    ok: false,
    error: {
      code: err?.code ? String(err.code) : 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Request failed',
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
      logger.warn(
        {
          err,
          event: `${event}_fail`,
          userId: socket.data.userId,
          socketId: socket.id,
          code: failure.error.code,
        },
        'fibbage',
      );
      deliverAck(ack, failure);
    }
  });
}

export function installFibbageHandlers({ socket, registry, logger }) {
  register(socket, logger, 'create_room', fibbageCreateRoomSchema, async (data) => {
    assertRoomCreationAllowed('fibbage', {
      isAdmin: Array.isArray(socket.data.roles) && socket.data.roles.includes('admin'),
    });
    await refreshSocketAvatarFromDb(socket, userRepository);
    const room = await registry.createRoom(socket, data.settings);
    registry.emitRoom(room.code, 'room_created');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'join_room', fibbageJoinRoomSchema, async (data) => {
    await refreshSocketAvatarFromDb(socket, userRepository);
    const room = await registry.joinRoom(socket, data.code);
    registry.emitRoom(room.code, 'member_joined');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'leave_room', null, async () => {
    const room = registry.getRoomForSocket(socket);
    const code = room?.code;
    await registry.leaveRoom(socket, { hardLeave: true });
    if (code) registry.emitRoom(code, 'member_left');
    return { left: true };
  });

  register(socket, logger, 'set_ready', fibbageSetReadySchema, async (data) => {
    const room = registry.setReady(socket, data.ready);
    registry.emitRoom(room.code, 'ready_changed');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'update_settings', fibbageUpdateSettingsSchema, async (data) => {
    const room = registry.updateSettings(socket, data);
    registry.emitRoom(room.code, 'settings_updated');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'get_categories', null, async () => {
    const categories = await registry.getCategories();
    return { categories };
  });

  register(socket, logger, 'start_game', null, async () => {
    const room = await registry.startRoomGame(socket);
    registry.emitRoom(room.code, 'game_started');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'submit_lie', fibbageSubmitLieSchema, async (data) => {
    const { room, transitionReason } = registry.submitRoomLie(socket, data.text);
    registry.emitRoom(room.code, transitionReason ?? 'lie_submitted');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'cast_vote', fibbageCastVoteSchema, async (data) => {
    const { room, transitionReason } = registry.castRoomVote(socket, data.answerId);
    registry.emitRoom(room.code, transitionReason ?? 'vote_cast');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'get_room_state', null, async () => {
    const snap = registry.snapshotForSocket(socket);
    if (!snap) {
      const err = new Error('Not in a room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    return { room: snap };
  });

  register(socket, logger, 'return_to_lobby', null, async () => {
    const room = registry.returnToLobby(socket);
    registry.emitRoom(room.code, 'returned_to_lobby');
    return { room: registry.snapshotForSocket(socket) };
  });
}
