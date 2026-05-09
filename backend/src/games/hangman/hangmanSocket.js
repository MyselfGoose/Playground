import { createSocketAuthMiddleware } from '../../middleware/socketAuthMiddleware.js';
import { createHangmanRoomManager } from './roomManager.js';
import { installHangmanHandlers } from './socketHandlers.js';

export function installHangmanSocketServer({ hangmanNs, registry, logger, tokenService }) {
  hangmanNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'hangman' }));

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
