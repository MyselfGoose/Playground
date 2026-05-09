import { createSocketAuthMiddleware } from "../../middleware/socketAuthMiddleware.js";
import { createTabooRoomManager } from "./roomManager.js";
import { installTabooHandlers } from "./socketHandlers.js";

export function installTabooSocketServer({ tabooNs, registry, logger, tokenService }) {
  tabooNs.use(createSocketAuthMiddleware({ tokenService, logger, nsTag: "taboo" }));

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
