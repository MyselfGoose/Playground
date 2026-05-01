import { Server } from 'socket.io';
import { createTokenService } from '../../services/tokenService.js';
import { resolveAccessContext } from '../../middleware/authMiddleware.js';
import { ACCESS_TOKEN_COOKIE } from '../../constants/auth.js';
import { parseCookies } from '../../utils/parseCookies.js';
import { createNpatRoomRegistry } from './roomManager.js';
import { installHandlers } from './socketHandlers.js';
import { createTypingRaceRegistry } from '../typing-race/roomRegistry.js';
import { installTypingRaceSocketServer } from '../typing-race/typingRaceSocket.js';
import { attachTabooNamespace } from '../taboo/tabooSocket.js';
import { attachCahNamespace } from '../cah/cahSocket.js';

/**
 * Read the access token off a Socket.IO handshake. Priority:
 *   1. explicit `auth.token` payload (tests, non-browser clients)
 *   2. `Authorization: Bearer` header
 *   3. `access_token` cookie (browser default)
 *
 * @param {import('socket.io').Socket['handshake']} handshake
 */
function readHandshakeToken(handshake) {
  const authPayload = /** @type {any} */ (handshake?.auth);
  if (authPayload && typeof authPayload.token === 'string' && authPayload.token.trim()) {
    return authPayload.token.trim();
  }
  const header = handshake?.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const cookies = parseCookies(handshake?.headers?.cookie);
  return cookies[ACCESS_TOKEN_COOKIE] ?? null;
}

/**
 * @param {{
 *   npatNs: import('socket.io').Namespace,
 *   registry: ReturnType<import('./roomManager.js').createNpatRoomRegistry>,
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 *   tokenService: ReturnType<import('../../services/tokenService.js').createTokenService>,
 * }} params
 */
export function installNpatSocketServer({ npatNs, registry, env, logger, tokenService }) {
  npatNs.use(async (socket, next) => {
    try {
      const token = readHandshakeToken(socket.handshake);
      if (!token) {
        return next(new Error('UNAUTHENTICATED'));
      }
      const ctx = await resolveAccessContext(token, { tokenService });
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      socket.data.roles = ctx.roles;
      socket.data.sid = ctx.sid;
      return next();
    } catch (err) {
      logger.debug(
        { err, event: 'npat_handshake_rejected', socketId: socket.id },
        'npat_socket',
      );
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  npatNs.on('connection', async (socket) => {
    const userId = /** @type {string} */ (socket.data.userId);
    const username = /** @type {string} */ (socket.data.username);
    logger.info({ event: 'npat_connected', userId, socketId: socket.id }, 'npat_socket');

    installHandlers({ socket, registry, env, logger });

    socket.on('disconnect', (reason) => {
      logger.info(
        { event: 'npat_disconnect', reason, userId, socketId: socket.id },
        'npat_socket',
      );
      registry.leaveRoom(socket);
    });

    // Opportunistically reattach to any active room the user belongs to. If this succeeds we
    // notify the client with `session_resumed` so it can navigate without user action.
    try {
      const engine = await registry.attachActiveRoomForUser(userId, username, socket);
      if (engine) {
        const room = engine.toPublicDto();
        socket.emit('session_resumed', { room });
        engine.emit('room_update', { room });
      }
    } catch (err) {
      logger.warn(
        { err, event: 'npat_session_resume_failed', userId, socketId: socket.id },
        'npat_socket',
      );
    }
  });
}

/**
 * @param {{
 *   server: import('node:http').Server,
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} params
 * @returns {{
 *   io: import('socket.io').Server,
 *   registry: ReturnType<import('./roomManager.js').createNpatRoomRegistry>,
 *   typingRaceRegistry: ReturnType<import('../typing-race/roomRegistry.js').createTypingRaceRegistry>,
 *   tabooRuntime: { close: () => void },
 *   cahRuntime: { close: () => void },
 * }}
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

  const tokenService = createTokenService(env);
  const npatNs = io.of('/npat');
  const registry = createNpatRoomRegistry({ env, logger, npatNs });
  installNpatSocketServer({ npatNs, registry, env, logger, tokenService });

  const typingRaceNs = io.of("/typing-race");
  const typingRaceRegistry = createTypingRaceRegistry({ typingNs: typingRaceNs, logger });
  installTypingRaceSocketServer({
    typingRaceNs,
    registry: typingRaceRegistry,
    logger,
    tokenService,
  });
  const tabooRuntime = attachTabooNamespace({ io, logger, tokenService });
  const cahRuntime = attachCahNamespace({ io, logger, tokenService });

  logger.info("socket_io_attached");
  return { io, registry, typingRaceRegistry, tabooRuntime, cahRuntime };
}
