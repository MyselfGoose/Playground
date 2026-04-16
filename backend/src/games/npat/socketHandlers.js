import { z } from 'zod';
import {
  createJoinRoomBodySchema,
  createRoomSchema,
  proposeEarlyFinishSchema,
  setReadySchema,
  startGameSchema,
  submitFieldSchema,
  switchTeamSchema,
  voteEarlyFinishSchema,
} from './validation/npat.schemas.js';

/**
 * Standard error shape returned to every client ack on failure.
 * @typedef {{ ok: true, data: any }} AckSuccess
 * @typedef {{ ok: false, error: { code: string, message: string } }} AckFailure
 * @typedef {AckSuccess | AckFailure} Ack
 */

/**
 * @param {unknown} ack
 * @param {Ack} payload
 * @param {import('pino').Logger} logger
 */
function deliverAck(ack, payload, logger) {
  if (typeof ack !== 'function') return;
  try {
    ack(payload);
  } catch (err) {
    logger.warn({ err, event: 'npat_ack_failed' }, 'npat_socket');
  }
}

/**
 * Translate any thrown value into a structured `AckFailure`. Zod errors map to VALIDATION_ERROR;
 * engine errors carry a `.code`; everything else becomes `INTERNAL_ERROR`.
 *
 * @param {unknown} err
 * @returns {AckFailure}
 */
function toAckFailure(err) {
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    const message = first
      ? `${first.path.length ? first.path.join('.') + ': ' : ''}${first.message}`
      : 'Validation failed';
    return { ok: false, error: { code: 'VALIDATION_ERROR', message } };
  }
  if (err && typeof err === 'object' && 'code' in err) {
    return {
      ok: false,
      error: {
        code: String(/** @type {any} */ (err).code),
        message: err instanceof Error ? err.message : 'Request failed',
      },
    };
  }
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Request failed',
    },
  };
}

/**
 * Build an event handler wrapper for a given socket. The wrapper:
 *   - validates payload with Zod
 *   - enforces optional per-socket rate limit (returns ack failure, never silent)
 *   - calls the handler
 *   - always sends a structured ack (no fire-and-forget, no thrown errors out of the handler)
 *
 * @param {{
 *   socket: import('socket.io').Socket,
 *   logger: import('pino').Logger,
 *   userId: string,
 *   username: string,
 *   rateState: Record<string, number>,
 * }} ctx
 */
function makeRegister(ctx) {
  const { socket, logger, userId } = ctx;
  /**
   * @template T
   * @param {string} event
   * @param {{
   *   schema?: import('zod').ZodType<T>,
   *   rateLimit?: { key: string, intervalMs: number },
   *   handler: (input: { data: T, socket: import('socket.io').Socket }) => Promise<unknown> | unknown,
   * }} def
   */
  return function register(event, { schema, rateLimit, handler }) {
    socket.on(event, async (payload, ack) => {
      try {
        if (rateLimit) {
          const now = Date.now();
          const last = ctx.rateState[rateLimit.key] ?? 0;
          if (now - last < rateLimit.intervalMs) {
            deliverAck(
              ack,
              { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
              logger,
            );
            return;
          }
          ctx.rateState[rateLimit.key] = now;
        }
        const data = schema ? schema.parse(payload ?? {}) : /** @type {T} */ (undefined);
        const result = await handler({ data, socket });
        deliverAck(ack, { ok: true, data: result ?? null }, logger);
      } catch (err) {
        const failure = toAckFailure(err);
        logger.warn(
          {
            err,
            event: `${event}_fail`,
            userId,
            socketId: socket.id,
            code: failure.error.code,
          },
          'npat_socket',
        );
        deliverAck(ack, failure, logger);
      }
    });
  };
}

/**
 * Install all npat socket handlers for a single connection.
 *
 * @param {{
 *   socket: import('socket.io').Socket,
 *   registry: ReturnType<import('./roomManager.js').createNpatRoomRegistry>,
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 */
export function installHandlers({ socket, registry, env, logger }) {
  const userId = /** @type {string} */ (socket.data.userId);
  const username = /** @type {string} */ (socket.data.username);
  const joinBodySchema = createJoinRoomBodySchema(env.NPAT_ROOM_CODE_LENGTH);

  /** @type {Record<string, number>} */
  const rateState = {};
  const register = makeRegister({ socket, logger, userId, username, rateState });

  /**
   * Resolve the engine the socket is currently in, else throw a structured error.
   */
  function requireEngine() {
    const engine = registry.getEngineForSocket(socket);
    if (!engine) {
      const err = new Error('Not in a room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    return engine;
  }

  register('create_room', {
    schema: createRoomSchema,
    handler: async ({ data }) => {
      registry.leaveRoom(socket);
      const { mode } = data;
      const { engine } = await registry.createRoom(mode, userId, username, socket);
      const room = engine.toPublicDto();
      engine.emit('room_update', { room });
      return { room };
    },
  });

  register('join_room', {
    schema: joinBodySchema,
    handler: async ({ data }) => {
      const prevCode = registry.socketToRoom.get(socket.id);
      if (prevCode && prevCode !== data.code) {
        registry.leaveRoom(socket);
      }
      const engine = await registry.joinRoom(data.code, userId, username, socket);
      const room = engine.toPublicDto();
      engine.emit('room_update', { room });
      return { room };
    },
  });

  register('leave_room', {
    handler: () => {
      registry.leaveRoom(socket);
      return { left: true };
    },
  });

  register('switch_team', {
    schema: switchTeamSchema,
    rateLimit: { key: 'switch_team', intervalMs: env.NPAT_SWITCH_TEAM_RATE_MS },
    handler: ({ data }) => {
      const engine = requireEngine();
      engine.switchTeam(userId, data.teamId);
      return { room: engine.toPublicDto() };
    },
  });

  register('set_ready', {
    schema: setReadySchema,
    handler: ({ data }) => {
      const engine = requireEngine();
      engine.setReady(userId, data.ready);
      return { room: engine.toPublicDto() };
    },
  });

  register('start_game', {
    schema: startGameSchema,
    handler: () => {
      const engine = requireEngine();
      engine.tryStartGame(userId);
      return { room: engine.toPublicDto() };
    },
  });

  register('submit_field', {
    schema: submitFieldSchema,
    rateLimit: { key: 'submit_field', intervalMs: env.NPAT_SUBMIT_RATE_MS },
    handler: ({ data }) => {
      const engine = requireEngine();
      engine.submitField(userId, data.field, data.value);
      return { field: data.field };
    },
  });

  register('propose_early_finish', {
    schema: proposeEarlyFinishSchema,
    rateLimit: { key: 'propose_early_finish', intervalMs: env.NPAT_EARLY_FINISH_PROPOSE_RATE_MS },
    handler: () => {
      const engine = requireEngine();
      engine.proposeEarlyFinish(userId);
      return { room: engine.toPublicDto() };
    },
  });

  register('vote_early_finish', {
    schema: voteEarlyFinishSchema,
    rateLimit: { key: 'vote_early_finish', intervalMs: env.NPAT_EARLY_FINISH_VOTE_RATE_MS },
    handler: ({ data }) => {
      const engine = requireEngine();
      engine.voteEarlyFinish(userId, data.accept);
      return { room: engine.toPublicDto() };
    },
  });
}
