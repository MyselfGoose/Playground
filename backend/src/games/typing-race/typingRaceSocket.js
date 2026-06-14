import { createSocketAuthMiddleware } from "../../middleware/socketAuthMiddleware.js";
import { installTypingRaceHandlers } from "./socketHandlers.js";

/**
 * @param {{
 *   typingRaceNs: import('socket.io').Namespace,
 *   registry: ReturnType<import('./roomRegistry.js').createTypingRaceRegistry>,
 *   logger: import('pino').Logger,
 *   tokenService: ReturnType<import('../../services/tokenService.js').createTokenService>,
 * }} params
 */
export function installTypingRaceSocketServer({
  typingRaceNs,
  registry,
  logger,
  tokenService,
}) {
  typingRaceNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: "typing_race" }));

  typingRaceNs.on("connection", (socket) => {
    const userId = /** @type {string} */ (socket.data.userId);
    logger.info({ event: "typing_race_connected", userId, socketId: socket.id }, "typing_race");

    const room = registry.attachActiveRoomForUser(socket);
    if (room) {
      room.emitRoom();
      socket.emit("session_resumed", { room: room.toPublicSnapshot() });
    }

    installTypingRaceHandlers({ socket, registry, logger });

    socket.on("disconnect", (reason) => {
      logger.info(
        { event: "typing_race_disconnect", reason, userId, socketId: socket.id },
        "typing_race",
      );
      registry.onSocketDisconnect(socket);
    });
  });
}
