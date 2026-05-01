import { resolveAccessContext } from '../../middleware/authMiddleware.js';
import { ACCESS_TOKEN_COOKIE } from '../../constants/auth.js';
import { parseCookies } from '../../utils/parseCookies.js';
import { createCahRoomManager } from './roomManager.js';
import { installCahHandlers } from './socketHandlers.js';

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

export function installCahSocketServer({ cahNs, registry, logger, tokenService }) {
  cahNs.use(async (socket, next) => {
    try {
      const token = readHandshakeToken(socket.handshake);
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const ctx = await resolveAccessContext(token, { tokenService });
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      return next();
    } catch (err) {
      logger.debug({ err, event: 'cah_handshake_rejected', socketId: socket.id }, 'cah');
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  cahNs.on('connection', (socket) => {
    const room = registry.attachActiveRoomForUser(socket);
    if (room) {
      socket.emit('session_resumed', { room: registry.snapshotForSocket(socket) });
      registry.emitRoom(room.code, 'session_resumed');
    }
    installCahHandlers({ socket, registry, logger });
    socket.on('disconnect', () => {
      registry.leaveRoom(socket, { hardLeave: false });
    });
  });
}

export function attachCahNamespace({ io, logger, tokenService }) {
  const cahNs = io.of('/cah');
  const registry = createCahRoomManager({ cahNs, logger });
  installCahSocketServer({ cahNs, registry, logger, tokenService });
  return {
    registry,
    close: () => registry.shutdown(),
  };
}
