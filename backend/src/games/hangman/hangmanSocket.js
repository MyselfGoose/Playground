import { resolveAccessContext } from '../../middleware/authMiddleware.js';
import { ACCESS_TOKEN_COOKIE } from '../../constants/auth.js';
import { parseCookies } from '../../utils/parseCookies.js';
import { createHangmanRoomManager } from './roomManager.js';
import { installHangmanHandlers } from './socketHandlers.js';

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

export function installHangmanSocketServer({ hangmanNs, registry, logger, tokenService }) {
  hangmanNs.use(async (socket, next) => {
    try {
      const token = readHandshakeToken(socket.handshake);
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const ctx = await resolveAccessContext(token, { tokenService });
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      return next();
    } catch (err) {
      logger.debug({ err, event: 'hangman_handshake_rejected', socketId: socket.id }, 'hangman');
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  hangmanNs.on('connection', async (socket) => {
    const room = await registry.attachActiveRoomForUser(socket);
    if (room) {
      socket.emit('session_resumed', { room: registry.snapshotForSocket(socket) });
      registry.emitRoom(room.code, 'session_resumed');
    }
    installHangmanHandlers({ socket, registry, logger });
    socket.on('disconnect', async () => {
      await registry.leaveRoom(socket, { hardLeave: false });
    });
  });
}

export function attachHangmanNamespace({ io, logger, tokenService }) {
  const hangmanNs = io.of('/hangman');
  const registry = createHangmanRoomManager({ hangmanNs, logger });
  installHangmanSocketServer({ hangmanNs, registry, logger, tokenService });
  return {
    registry,
    close: () => registry.shutdown(),
  };
}
