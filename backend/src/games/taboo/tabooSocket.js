import { resolveAccessContext } from "../../middleware/authMiddleware.js";
import { ACCESS_TOKEN_COOKIE } from "../../constants/auth.js";
import { parseCookies } from "../../utils/parseCookies.js";
import { createTabooRoomManager } from "./roomManager.js";
import { installTabooHandlers } from "./socketHandlers.js";

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

export function installTabooSocketServer({ tabooNs, registry, logger, tokenService }) {
  tabooNs.use(async (socket, next) => {
    try {
      const token = readHandshakeToken(socket.handshake);
      if (!token) return next(new Error("UNAUTHENTICATED"));
      const ctx = await resolveAccessContext(token, { tokenService });
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      return next();
    } catch (err) {
      logger.debug({ err, event: "taboo_handshake_rejected", socketId: socket.id }, "taboo");
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  tabooNs.on("connection", (socket) => {
    const room = registry.attachActiveRoomForUser(socket);
    if (room) {
      socket.emit("session_resumed", { room: registry.snapshotFor(socket) });
      registry.emitRoom(room.code, "session_resumed");
    }
    installTabooHandlers({ socket, registry, logger });
    socket.on("disconnect", () => {
      registry.leaveRoom(socket, { hardLeave: false });
    });
  });
}

export function attachTabooNamespace({ io, logger, tokenService }) {
  const tabooNs = io.of("/taboo");
  const registry = createTabooRoomManager({ tabooNs, logger });
  installTabooSocketServer({ tabooNs, registry, logger, tokenService });
  const ticker = setInterval(() => {
    const updates = registry.tick();
    for (const update of updates) registry.emitRoom(update.code, update.reason);
  }, 1000);
  ticker.unref();
  return {
    registry,
    close: () => {
      clearInterval(ticker);
      registry.shutdown();
    },
  };
}
