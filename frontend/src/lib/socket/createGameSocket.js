/**
 * Shared Socket.IO client factory: async auth admission, reconnect recovery, visibility resync.
 */

import { io } from "socket.io-client";
import { getSocketBase, apiFetch } from "../api.js";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import {
  isSocketAuthErrorMessage,
  registerSocketTeardown,
  socketAuthUserMessage,
} from "../session/sessionInvalidation.js";
import { recoverSocketAuthAfterHandshakeFailure } from "./recoverSocketAuth.js";
import { fetchAdmissionToken as defaultFetchAdmission } from "./socketUtils.js";

const DEFAULT_RECONNECTION_ATTEMPTS = 10;
const DEFAULT_RECONNECTION_DELAY_MAX = 5000;

/**
 * @typedef {Object} GameSocketConnectOptions
 * @property {string} namespace e.g. `/npat`, `/cah`
 * @property {string} gameTag reconcile event prefix, e.g. `npat`
 * @property {() => Promise<string>} [fetchAdmissionToken]
 * @property {typeof apiFetch} [apiFetchFn]
 * @property {(socket: import('socket.io-client').Socket) => void} [onConnect]
 * @property {(socket: import('socket.io-client').Socket) => void} [onDisconnect]
 * @property {(socket: import('socket.io-client').Socket) => void} [onReconnect]
 * @property {(socket: import('socket.io-client').Socket) => void} [onReconnectFailed]
 * @property {(socket: import('socket.io-client').Socket, message: string) => void} [onConnectError]
 * @property {(socket: import('socket.io-client').Socket) => void} [onVisibilityResync]
 * @property {boolean} [visibilityResync]
 */

/**
 * @param {GameSocketConnectOptions} options
 * @returns {{ socket: import('socket.io-client').Socket, cleanup: () => void }}
 */
export function connectGameSocket(options) {
  const {
    namespace,
    gameTag,
    fetchAdmissionToken = () => defaultFetchAdmission(apiFetch),
    apiFetchFn = apiFetch,
    onConnect,
    onDisconnect,
    onReconnect,
    onReconnectFailed,
    onConnectError,
    onVisibilityResync,
    visibilityResync = Boolean(onVisibilityResync),
  } = options;

  const sockBase = getSocketBase();
  if (!sockBase) {
    throw new Error("MISSING_SOCKET_URL");
  }

  const ns = namespace.startsWith("/") ? namespace : `/${namespace}`;
  const socket = io(`${sockBase}${ns}`, {
    path: "/socket.io",
    withCredentials: true,
    auth: (cb) => {
      fetchAdmissionToken()
        .then((token) => {
          cb({ token });
        })
        .catch(() => {
          cb({ token: "" });
        });
    },
    transports: ["polling", "websocket"],
    autoConnect: true,
    reconnectionAttempts: DEFAULT_RECONNECTION_ATTEMPTS,
    reconnectionDelayMax: DEFAULT_RECONNECTION_DELAY_MAX,
  });

  let reconnectRecoveryInFlight = false;

  const handleConnectError = async (err) => {
    const msg = err?.message ?? "Could not connect";
    if (isSocketAuthErrorMessage(msg)) {
      try {
        await recoverSocketAuthAfterHandshakeFailure(socket, apiFetchFn, fetchAdmissionToken);
        return;
      } catch {
        socket.disconnect();
        onConnectError?.(socket, socketAuthUserMessage(msg));
        dispatchReconcile(`${gameTag}_refresh_failed`);
        return;
      }
    }
    onConnectError?.(socket, msg);
  };

  const handleReconnectFailed = async () => {
    if (reconnectRecoveryInFlight) return;
    reconnectRecoveryInFlight = true;
    try {
      await recoverSocketAuthAfterHandshakeFailure(socket, apiFetchFn, fetchAdmissionToken);
      socket.io.reconnection(true);
      socket.connect();
    } catch {
      socket.disconnect();
      onReconnectFailed?.(socket);
      dispatchReconcile(`${gameTag}_reconnect_failed`);
    } finally {
      reconnectRecoveryInFlight = false;
    }
  };

  socket.on("connect", () => {
    onConnect?.(socket);
  });
  socket.on("disconnect", () => {
    onDisconnect?.(socket);
  });
  socket.on("connect_error", (err) => {
    void handleConnectError(err);
  });
  socket.on("reconnect", () => {
    onReconnect?.(socket);
    dispatchReconcile(`${gameTag}_reconnected`);
  });
  socket.io.on("reconnect_failed", () => {
    void handleReconnectFailed();
  });

  /** @type {(() => void) | null} */
  let visCleanup = null;
  if (visibilityResync && onVisibilityResync) {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && socket.connected) {
        onVisibilityResync(socket);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    visCleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  const unregisterTeardown = registerSocketTeardown(() => {
    socket.removeAllListeners();
    socket.io.off("reconnect_failed");
    socket.disconnect();
  });

  const cleanup = () => {
    unregisterTeardown();
    if (visCleanup) visCleanup();
    socket.removeAllListeners();
    socket.io.off("reconnect_failed");
    socket.disconnect();
  };

  return { socket, cleanup };
}
