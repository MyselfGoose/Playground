import { z } from 'zod';
import {
  hangmanCreateRoomSchema,
  hangmanGuessLetterSchema,
  hangmanJoinRoomSchema,
  hangmanRandomWordSchema,
  hangmanSetReadySchema,
  hangmanSetterWordSchema,
  hangmanUpdateSettingsSchema,
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
        'hangman',
      );
      deliverAck(ack, failure);
    }
  });
}

export function installHangmanHandlers({ socket, registry, logger }) {
  register(socket, logger, 'create_room', hangmanCreateRoomSchema, async (data) => {
    const room = await registry.createRoom(socket, data);
    registry.emitRoom(room.code, 'room_created');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'join_room', hangmanJoinRoomSchema, async (data) => {
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

  register(socket, logger, 'set_ready', hangmanSetReadySchema, async (data) => {
    const room = registry.setReady(socket, data.ready);
    registry.emitRoom(room.code, 'ready_changed');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'update_settings', hangmanUpdateSettingsSchema, async (data) => {
    const room = registry.updateSettings(socket, data);
    registry.emitRoom(room.code, 'settings_updated');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'start_game', null, async () => {
    const room = await registry.startRoomGame(socket);
    registry.emitRoom(room.code, 'game_started');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'setter_submit_word', hangmanSetterWordSchema, async (data) => {
    const room = registry.submitSetterWord(socket, data.word);
    registry.emitRoom(room.code, 'word_set');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'setter_request_random_word', hangmanRandomWordSchema, async (data) => {
    const room = await registry.requestRandomWord(socket, data);
    registry.emitRoom(room.code, 'random_word');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'guess_letter', hangmanGuessLetterSchema, async (data) => {
    const room = registry.submitGuess(socket, data.letter);
    registry.emitRoom(room.code, 'guess');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'next_round', null, async () => {
    const room = await registry.advanceRound(socket);
    registry.emitRoom(room.code, room.game?.phase === 'game_end' ? 'game_finished' : 'next_round');
    return { room: registry.snapshotForSocket(socket) };
  });

  register(socket, logger, 'get_room_state', null, async () => {
    return { room: registry.snapshotForSocket(socket) };
  });
}
