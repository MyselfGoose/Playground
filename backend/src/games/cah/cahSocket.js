import { createSocketAuthMiddleware } from '../../middleware/socketAuthMiddleware.js';
import { createCahRoomManager } from './roomManager.js';
import { installCahHandlers } from './socketHandlers.js';

export function installCahSocketServer({ cahNs, registry, logger, tokenService }) {
  cahNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'cah' }));

  cahNs.on('connection', async (socket) => {
    const room = await registry.attachActiveRoomForUser(socket);
    if (room) {
      registry.emitRoom(room.code, 'player_reconnected');
      socket.emit('session_resumed', { room: registry.snapshotForSocket(socket) });
    }
    installCahHandlers({ socket, registry, logger });
    socket.on('disconnect', async () => {
      try {
        await registry.leaveRoom(socket, { hardLeave: false });
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'cah disconnect handler error');
      }
    });
  });
}

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   logger: import('pino').Logger,
 *   tokenService: ReturnType<import('../../services/tokenService.js').createTokenService>,
 *   env: import('../../config/env.js').Env,
 * }} params
 */
export function attachCahNamespace({ io, logger, tokenService, env }) {
  const cahNs = io.of('/cah');
  const registry = createCahRoomManager({ cahNs, logger, maxPlayers: env.CAH_MAX_PLAYERS });
  installCahSocketServer({ cahNs, registry, logger, tokenService });
  return {
    registry,
    close: () => registry.shutdown(),
  };
}
