import { createSocketAuthMiddleware } from '../../middleware/socketAuthMiddleware.js';
import { userRepository } from '../../repositories/userRepository.js';
import { refreshSocketAvatarFromDb } from '../../utils/lobbyPlayerAvatar.js';
import { createFibbageRoomManager } from './roomManager.js';
import { installFibbageHandlers } from './socketHandlers.js';
import { FIBBAGE_TICK_INTERVAL_MS } from './constants.js';

export function installFibbageSocketServer({ fibbageNs, registry, logger, tokenService }) {
  fibbageNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'fibbage' }));

  fibbageNs.on('connection', async (socket) => {
    await refreshSocketAvatarFromDb(socket, userRepository);
    logger.info(
      { userId: socket.data.userId, socketId: socket.id, ns: 'fibbage' },
      'fibbage socket connected',
    );
    const room = registry.attachActiveRoomForUser(socket);
    if (room) {
      logger.info(
        { userId: socket.data.userId, socketId: socket.id, roomCode: room.code, resumed: true },
        'fibbage session resumed',
      );
      registry.emitRoom(room.code, 'player_reconnected');
      socket.emit('session_resumed', { room: registry.snapshotForSocket(socket) });
    }
    installFibbageHandlers({ socket, registry, logger });
    socket.on('disconnect', (reason) => {
      logger.info(
        { userId: socket.data.userId, socketId: socket.id, reason, ns: 'fibbage' },
        'fibbage socket disconnected',
      );
      try {
        void registry.leaveRoom(socket, { hardLeave: false });
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'fibbage disconnect handler error');
      }
    });
  });
}

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   logger: import('pino').Logger,
 *   tokenService: ReturnType<import('../../services/tokenService.js').createTokenService>,
 * }} params
 */
export function attachFibbageNamespace({ io, logger, tokenService }) {
  const fibbageNs = io.of('/fibbage');
  const registry = createFibbageRoomManager({ fibbageNs, logger });
  installFibbageSocketServer({ fibbageNs, registry, logger, tokenService });
  const ticker = setInterval(() => {
    registry.tick();
  }, FIBBAGE_TICK_INTERVAL_MS);
  ticker.unref();
  return {
    registry,
    close: () => {
      clearInterval(ticker);
      registry.shutdown();
    },
  };
}
