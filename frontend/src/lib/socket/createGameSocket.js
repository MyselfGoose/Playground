/**
 * Shared Socket.IO client factory: async auth admission, reconnect recovery, visibility resync.
 *
 * Reliability guarantees:
 * - Unlimited reconnection attempts with exponential backoff (never gives up)
 * - Auth vs network failure classification (no false session expiry)
 * - Visibility-driven reconnection for mobile background/foreground
 * - Slow-poll fallback when primary reconnection exhausts
 * - Race-condition-safe auth recovery
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

const RECONNECTION_DELAY_MAX_MS = 8000;
const SLOW_POLL_INTERVAL_MS = 10_000;
const SLOW_POLL_MAX_DURATION_MS = 5 * 60_000;
const BACKGROUND_STALE_THRESHOLD_MS = 30_000;

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
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Could not obtain admission token";
          cb({ error: message });
        });
    },
    transports: ["polling", "websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
    connectionStateRecovery: {
      maxDisconnectionDuration: 120_000,
    },
  });

  let reconnectRecoveryInFlight = false;
  let lastConnectErrorWasAuth = false;
  let slowPollTimer = /** @type {ReturnType<typeof setInterval> | null} */ (null);
  let slowPollStartedAt = 0;
  let hiddenSince = /** @type {number | null} */ (null);

  function clearSlowPoll() {
    if (slowPollTimer) {
      clearInterval(slowPollTimer);
      slowPollTimer = null;
    }
    slowPollStartedAt = 0;
  }

  /**
   * Slow-poll fallback: after Socket.IO's built-in reconnection gives up or the socket
   * is manually disconnected due to unrecoverable auth, this polls periodically to detect
   * when the server becomes available again.
   */
  function startSlowPoll() {
    if (slowPollTimer) return;
    slowPollStartedAt = Date.now();
    slowPollTimer = setInterval(() => {
      if (socket.connected) {
        clearSlowPoll();
        return;
      }
      if (Date.now() - slowPollStartedAt > SLOW_POLL_MAX_DURATION_MS) {
        clearSlowPoll();
        onReconnectFailed?.(socket);
        dispatchReconcile(`${gameTag}_reconnect_exhausted`);
        return;
      }
      socket.connect();
    }, SLOW_POLL_INTERVAL_MS);
  }

  const handleConnectError = async (err) => {
    const msg = err?.message ?? "Could not connect";
    if (isSocketAuthErrorMessage(msg)) {
      lastConnectErrorWasAuth = true;
      try {
        const result = await recoverSocketAuthAfterHandshakeFailure(
          socket,
          apiFetchFn,
          fetchAdmissionToken,
        );
        if (result?.deferred) {
          return;
        }
        return;
      } catch {
        socket.disconnect();
        onConnectError?.(socket, socketAuthUserMessage(msg));
        dispatchReconcile(`${gameTag}_refresh_failed`);
        return;
      }
    }
    lastConnectErrorWasAuth = false;
    onConnectError?.(socket, msg);
  };

  const handleReconnectFailed = async () => {
    if (reconnectRecoveryInFlight) return;
    reconnectRecoveryInFlight = true;
    try {
      if (lastConnectErrorWasAuth) {
        await recoverSocketAuthAfterHandshakeFailure(socket, apiFetchFn, fetchAdmissionToken);
        socket.io.reconnection(true);
      } else {
        socket.io.reconnection(true);
        startSlowPoll();
      }
    } catch {
      startSlowPoll();
    } finally {
      reconnectRecoveryInFlight = false;
    }
  };

  socket.on("connect", () => {
    clearSlowPoll();
    lastConnectErrorWasAuth = false;
    onConnect?.(socket);
  });

  socket.on("disconnect", (reason) => {
    onDisconnect?.(socket);
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  socket.on("connect_error", (err) => {
    void handleConnectError(err);
  });

  socket.io.on("reconnect", () => {
    clearSlowPoll();
    lastConnectErrorWasAuth = false;
    onReconnect?.(socket);
    dispatchReconcile(`${gameTag}_reconnected`);
  });

  socket.io.on("reconnect_failed", () => {
    void handleReconnectFailed();
  });

  /** @type {(() => void) | null} */
  let visCleanup = null;
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      hiddenSince = Date.now();
      return;
    }

    const wasHiddenFor = hiddenSince ? Date.now() - hiddenSince : 0;
    hiddenSince = null;

    if (!socket.connected) {
      clearSlowPoll();
      socket.io.reconnection(true);
      socket.connect();
      return;
    }

    if (wasHiddenFor > BACKGROUND_STALE_THRESHOLD_MS && visibilityResync && onVisibilityResync) {
      onVisibilityResync(socket);
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  visCleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);

  if (typeof window !== "undefined") {
    const onOnline = () => {
      if (!socket.connected) {
        socket.io.reconnection(true);
        socket.connect();
      }
    };
    window.addEventListener("online", onOnline);
    const prevVisCleanup = visCleanup;
    visCleanup = () => {
      prevVisCleanup?.();
      window.removeEventListener("online", onOnline);
    };
  }

  const unregisterTeardown = registerSocketTeardown(() => {
    clearSlowPoll();
    socket.removeAllListeners();
    socket.io.off("reconnect_failed");
    socket.io.off("reconnect");
    socket.disconnect();
  });

  const cleanup = () => {
    clearSlowPoll();
    unregisterTeardown();
    if (visCleanup) visCleanup();
    socket.removeAllListeners();
    socket.io.off("reconnect_failed");
    socket.io.off("reconnect");
    socket.disconnect();
  };

  return { socket, cleanup };
}
