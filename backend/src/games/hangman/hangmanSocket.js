import { createSocketAuthMiddleware } from '../../middleware/socketAuthMiddleware.js';
import { createHangmanRoomManager } from './roomManager.js';
import { installHangmanHandlers } from './socketHandlers.js';

export function installHangmanSocketServer({ hangmanNs, registry, logger, tokenService }) {
  hangmanNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'hangman' }));

  hangmanNs.on('connection', async (socket) => {
    const room = await registry.attachActiveRoomForUser(socket);
    if (room) {
      registry.emitRoom(room.code, 'player_reconnected');
      socket.emit('session_resumed', { room: registry.snapshotForSocket(socket) });
    }
    installHangmanHandlers({ socket, registry, logger });
    socket.on('disconnect', async () => {
      try {
        await registry.leaveRoom(socket, { hardLeave: false });
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'hangman disconnect handler error');
      }
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
