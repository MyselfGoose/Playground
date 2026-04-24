import { resolveAccessContext } from "../../middleware/authMiddleware.js";
import { ACCESS_TOKEN_COOKIE } from "../../constants/auth.js";
import { parseCookies } from "../../utils/parseCookies.js";
import { installTypingRaceHandlers } from "./socketHandlers.js";

/**
 * @param {import('socket.io').Socket['handshake']} handshake
 */
function readHandshakeToken(handshake) {
  const authPayload = /** @type {any} */ (handshake?.auth);
  if (authPayload && typeof authPayload.token === "string" && authPayload.token.trim()) {
    return authPayload.token.trim();
  }
  const header = handshake?.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const cookies = parseCookies(handshake?.headers?.cookie);
  return cookies[ACCESS_TOKEN_COOKIE] ?? null;
}

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
  typingRaceNs.use(async (socket, next) => {
    try {
      const token = readHandshakeToken(socket.handshake);
      if (!token) {
        return next(new Error("UNAUTHENTICATED"));
      }
      const ctx = await resolveAccessContext(token, { tokenService });
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      socket.data.roles = ctx.roles;
      socket.data.sid = ctx.sid;
      return next();
    } catch (err) {
      logger.debug(
        { err, event: "typing_race_handshake_rejected", socketId: socket.id },
        "typing_race",
      );
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  typingRaceNs.on("connection", (socket) => {
    const userId = /** @type {string} */ (socket.data.userId);
    logger.info({ event: "typing_race_connected", userId, socketId: socket.id }, "typing_race");

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
