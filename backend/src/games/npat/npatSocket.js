import { Server } from 'socket.io';
import { createTokenService } from '../../services/tokenService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { ACCESS_TOKEN_COOKIE } from '../../constants/auth.js';
import { parseCookies } from '../../utils/parseCookies.js';
import {
  createRoomSchema,
  joinRoomSchema,
  setReadySchema,
  startGameSchema,
  submitFieldSchema,
  switchTeamSchema,
} from './validation/npat.schemas.js';
import { createNpatRoomRegistry } from './roomManager.js';

/**
 * @param {{
 *   npatNs: import('socket.io').Namespace,
 *   registry: ReturnType<import('./roomManager.js').createNpatRoomRegistry>,
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 */
export function installNpatSocketServer({ npatNs, registry, env, logger }) {
  const tokenService = createTokenService(env);

  npatNs.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      const token = cookies[ACCESS_TOKEN_COOKIE];
      if (!token) {
        return next(new Error('UNAUTHENTICATED'));
      }
      const { sub } = await tokenService.verifyAccessToken(token);
      const user = await userRepository.findByIdLean(sub);
      if (!user?.isActive) {
        return next(new Error('UNAUTHENTICATED'));
      }
      socket.data.userId = String(user._id);
      socket.data.username = user.username;
      return next();
    } catch {
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  npatNs.on('connection', (socket) => {
    const userId = /** @type {string} */ (socket.data.userId);
    const username = /** @type {string} */ (socket.data.username);

    let lastSubmit = 0;
    let lastSwitch = 0;

    /**
     * @param {unknown} err
     */
    function emitErr(err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : 'UNKNOWN';
      const message = err instanceof Error ? err.message : 'Request failed';
      socket.emit('error', { code, message });
    }

    /**
     * @param {string} rawCode
     */
    function normalizeRoomCode(rawCode) {
      const digits = String(rawCode).replace(/\D/g, '');
      const len = env.NPAT_ROOM_CODE_LENGTH;
      if (digits.length > len) {
        return digits.slice(-len);
      }
      return digits.padStart(len, '0');
    }

    socket.on('create_room', async (payload) => {
      try {
        registry.leaveRoom(socket);
        const { mode } = createRoomSchema.parse(payload ?? {});
        const { code, engine } = await registry.createRoom(mode, userId, username, socket);
        npatNs.to(code).emit('room_update', { room: engine.toPublicDto() });
      } catch (err) {
        logger.warn({ err, event: 'create_room' }, 'npat_socket_error');
        emitErr(err);
      }
    });

    socket.on('join_room', async (payload) => {
      try {
        const parsed = joinRoomSchema.parse(payload ?? {});
        const code = normalizeRoomCode(parsed.code);
        registry.leaveRoom(socket);
        const engine = await registry.joinRoom(code, userId, username, socket);
        npatNs.to(code).emit('room_update', { room: engine.toPublicDto() });
      } catch (err) {
        logger.warn({ err, event: 'join_room' }, 'npat_socket_error');
        emitErr(err);
      }
    });

    socket.on('leave_room', () => {
      try {
        registry.leaveRoom(socket);
      } catch (err) {
        emitErr(err);
      }
    });

    socket.on('switch_team', (payload) => {
      try {
        const now = Date.now();
        if (now - lastSwitch < env.NPAT_SWITCH_TEAM_RATE_MS) {
          const err = new Error('Too many team changes');
          /** @type {any} */ (err).code = 'RATE_LIMIT';
          throw err;
        }
        lastSwitch = now;
        const { teamId } = switchTeamSchema.parse(payload ?? {});
        const engine = registry.getEngineForSocket(socket);
        if (!engine) {
          const err = new Error('Not in a room');
          /** @type {any} */ (err).code = 'NOT_IN_ROOM';
          throw err;
        }
        engine.switchTeam(userId, teamId);
      } catch (err) {
        emitErr(err);
      }
    });

    socket.on('set_ready', (payload) => {
      try {
        const { ready } = setReadySchema.parse(payload ?? {});
        const engine = registry.getEngineForSocket(socket);
        if (!engine) {
          const err = new Error('Not in a room');
          /** @type {any} */ (err).code = 'NOT_IN_ROOM';
          throw err;
        }
        engine.setReady(userId, ready);
      } catch (err) {
        emitErr(err);
      }
    });

    socket.on('start_game', (payload) => {
      try {
        startGameSchema.parse(payload ?? {});
        const engine = registry.getEngineForSocket(socket);
        if (!engine) {
          const err = new Error('Not in a room');
          /** @type {any} */ (err).code = 'NOT_IN_ROOM';
          throw err;
        }
        engine.tryStartGame(userId);
      } catch (err) {
        emitErr(err);
      }
    });

    socket.on('submit_field', (payload) => {
      try {
        const now = Date.now();
        if (now - lastSubmit < env.NPAT_SUBMIT_RATE_MS) {
          return;
        }
        lastSubmit = now;
        const { field, value } = submitFieldSchema.parse(payload ?? {});
        const engine = registry.getEngineForSocket(socket);
        if (!engine) {
          const err = new Error('Not in a room');
          /** @type {any} */ (err).code = 'NOT_IN_ROOM';
          throw err;
        }
        engine.submitField(userId, field, value);
      } catch (err) {
        emitErr(err);
      }
    });

    socket.on('disconnect', () => {
      registry.leaveRoom(socket);
    });
  });
}

/**
 * @param {{
 *   server: import('node:http').Server,
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 * @returns {import('socket.io').Server}
 */
export function attachSocketIo({ server, env, logger }) {
  const origins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const originOpt = origins.length === 1 ? origins[0] : origins;

  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: originOpt, credentials: true },
    serveClient: false,
  });

  const npatNs = io.of('/npat');
  const registry = createNpatRoomRegistry({ env, logger, npatNs });
  installNpatSocketServer({ npatNs, registry, env, logger });

  logger.info('socket_io_attached');
  return io;
}
