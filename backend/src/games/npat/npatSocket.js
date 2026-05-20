import { createTokenService } from '../../services/tokenService.js';
import { createSocketAuthMiddleware } from '../../middleware/socketAuthMiddleware.js';
import { installHandlers } from './socketHandlers.js';

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
  npatNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: 'npat_socket' }));

  npatNs.on('connection', async (socket) => {
    const userId = /** @type {string} */ (socket.data.userId);
    const username = /** @type {string} */ (socket.data.username);
    logger.info({ event: 'npat_connected', userId, socketId: socket.id }, 'npat_socket');

    installHandlers({ socket, registry, env, logger });

    socket.on('disconnect', async (reason) => {
      logger.info(
        { event: 'npat_disconnect', reason, userId, socketId: socket.id },
        'npat_socket',
      );
      try {
        await registry.leaveRoom(socket);
      } catch (err) {
        logger.warn(
          { err, event: 'npat_disconnect_leave_failed', userId, socketId: socket.id },
          'npat_socket',
        );
      }
    });

    // attachActiveRoomForUser runs before session_resumed so reconnect always sees consistent room state.
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

/** @deprecated Import from `realtime/socketServer.js` — re-exported for backward compatibility. */
export { attachSocketIo } from '../../realtime/socketServer.js';
