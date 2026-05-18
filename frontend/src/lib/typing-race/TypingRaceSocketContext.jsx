"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getSocketBase, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { connectGameSocket } from "../socket/createGameSocket.js";
import { SESSION_EXPIRED_MESSAGE } from "../session/sessionInvalidation.js";
import { ackToResult, ACK_TIMEOUT_MS } from "../socket/socketUtils.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

const TypingRaceContext = createContext(null);

const DEV = process.env.NODE_ENV !== "production";

const TYPING_ROOM_STORAGE_KEY = "playgrounds:typing-race:last-room-code";

/**
 * Maps socket / ack errors to copy suitable for UI toasts and inline alerts.
 * @param {unknown} err
 */
export function typingRaceUserFacingError(err) {
  if (!err) {
    return "Something went wrong.";
  }
  const e = err instanceof Error ? err : new Error(String(err));
  const code = /** @type {any} */ (e).code;
  if (code === "NOT_CONNECTED") {
    const detail = /** @type {any} */ (e).connectDetail;
    return mapConnectionError("typing-race", detail || e);
  }
  if (code === "ACK_TIMEOUT") {
    return mapConnectionError("typing-race", e, { phase: "timeout" });
  }
  if (code === "EMIT_FAILED") {
    return mapConnectionError("typing-race", e.message || e);
  }
  if (code === "SOCKET_NOT_AUTHENTICATED") {
    return mapConnectionError("typing-race", e, { phase: "reconnect" });
  }
  return mapConnectionError("typing-race", e.message || e);
}

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function waitUntilSocketConnected(socket, timeoutMs) {
  if (socket.connected) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      socket.off("connect", onOk);
      resolve(socket.connected);
    }, timeoutMs);
    const onOk = () => {
      clearTimeout(t);
      resolve(true);
    };
    socket.once("connect", onOk);
  });
}

/** @typedef {Record<string, unknown> | null} RoomSnap */

export function TypingRaceProvider({ children }) {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? "";
  const router = useRouter();
  const [room, setRoom] = useState(/** @type {RoomSnap} */ (null));
  const [connected, setConnected] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [socketError, setSocketError] = useState(
    /** @type {string | null} */ (!getSocketBase() ? connectionMessage("typing-race", "missing_socket_url") : null),
  );
  /** Plan F: explicit socket lifecycle for UX + emit gating. */
  const [socketLifecycle, setSocketLifecycle] = useState(
    /** @type {'DISCONNECTED'|'CONNECTING'|'AUTHENTICATING'|'AUTHENTICATED'|'RECONNECTING'|'FAILED'} */ (
      "DISCONNECTED"
    ),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));
  const authenticatedRef = useRef(false);
  const lastConnectErrorRef = useRef(/** @type {string | null} */ (null));
  const eventRateRef = useRef({ tickAt: Date.now(), peerProgress: 0 });
  const resyncDebounceRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const isConnecting = !connected && !socketError;

  const applyRoom = useCallback((r) => {
    if (r && typeof r === "object") {
      const sn = /** @type {any} */ (r).serverNow;
      if (typeof sn === "number") {
        setServerOffsetMs(sn - Date.now());
      }
      const rc = /** @type {any} */ (r).roomCode;
      if (typeof rc === "string" && typeof sessionStorage !== "undefined") {
        const digits = rc.replace(/\D/g, "");
        if (digits.length >= 4) {
          sessionStorage.setItem(TYPING_ROOM_STORAGE_KEY, digits);
        }
      }
      setRoom(r);
    } else {
      setRoom(null);
    }
  }, []);

  const emitAck = useCallback((event, payload) => {
    return (async () => {
      const socket = socketRef.current;
      if (!socket) {
        return {
          ok: false,
          error: Object.assign(
            new Error("Multiplayer is still starting. Wait until you see \u201cConnected to server\u201d, then try again."),
            { code: "NOT_CONNECTED", connectDetail: "No socket yet" },
          ),
        };
      }
      if (!socket.connected) {
        socket.connect();
        const ok = await waitUntilSocketConnected(socket, 10_000);
        if (!ok || !socket.connected) {
          const detail = lastConnectErrorRef.current || "The server did not accept the connection in time.";
          return {
            ok: false,
            error: Object.assign(new Error(mapConnectionError("typing-race", detail)), {
              code: "NOT_CONNECTED",
              connectDetail: detail,
            }),
          };
        }
      }
      if (!authenticatedRef.current) {
        return {
          ok: false,
          error: Object.assign(new Error("Reconnecting to game server… Try again in a moment."), {
            code: "SOCKET_NOT_AUTHENTICATED",
          }),
        };
      }
      return await new Promise((resolve) => {
        try {
          socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
            const result = ackToResult(err, res);
            if (result.ok) {
              resolve({ ok: true, data: result.data });
            } else {
              resolve({ ok: false, error: result.error });
            }
          });
        } catch (e) {
          resolve({
            ok: false,
            error: Object.assign(
              e instanceof Error ? e : new Error(String(e)),
              { code: "EMIT_FAILED" },
            ),
          });
        }
      });
    })();
  }, []);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }
    if (!userId) {
      return undefined;
    }
    const sockBase = getSocketBase();
    if (!sockBase) {
      return undefined;
    }

    let cancelled = false;
    /** @type {import('socket.io-client').Socket | null} */
    let socket = null;

    /** @type {(() => void) | null} */
    let socketCleanup = null;

    const tryRejoinStoredRoom = (targetSocket) => {
        const s = targetSocket ?? socket;
        if (cancelled || !s?.connected || typeof sessionStorage === "undefined") return;
        const digits = String(sessionStorage.getItem(TYPING_ROOM_STORAGE_KEY) ?? "").replace(/\D/g, "");
        if (digits.length < 4) return;
        s.timeout(ACK_TIMEOUT_MS).emit("typing_join_room", { roomCode: digits }, (err, res) => {
          if (err || !res?.ok || !res?.data?.room) {
            sessionStorage.removeItem(TYPING_ROOM_STORAGE_KEY);
            return;
          }
          applyRoom(res.data.room);
        });
      };

      const resyncRoom = (targetSocket) => {
        const s = targetSocket ?? socket;
        if (cancelled || !s?.connected) return;
        s.timeout(ACK_TIMEOUT_MS).emit("typing_get_room_state", {}, (err, res) => {
          if (err || !res?.ok) {
            tryRejoinStoredRoom(s);
            return;
          }
          if (res?.data?.room) {
            applyRoom(res.data.room);
            return;
          }
          tryRejoinStoredRoom(s);
        });
      };

      const scheduleResync = (targetSocket) => {
        if (resyncDebounceRef.current) clearTimeout(resyncDebounceRef.current);
        resyncDebounceRef.current = setTimeout(() => {
          resyncDebounceRef.current = null;
          resyncRoom(targetSocket);
        }, 300);
      };

      const onRoom = (payload) => {
        if (payload?.room) {
          applyRoom(payload.room);
        }
      };

    try {
      setSocketLifecycle("CONNECTING");
      const { socket: gameSocket, cleanup } = connectGameSocket({
        namespace: "/typing-race",
        gameTag: "typing",
        onConnect: (s) => {
          if (cancelled) return;
          lastConnectErrorRef.current = null;
          authenticatedRef.current = true;
          setConnected(s.connected);
          setSocketError(null);
          setSocketLifecycle("AUTHENTICATED");
          scheduleResync(s);
        },
        onDisconnect: () => {
          if (cancelled) return;
          authenticatedRef.current = false;
          setConnected(false);
          setSocketLifecycle("DISCONNECTED");
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          authenticatedRef.current = false;
          lastConnectErrorRef.current = msg;
          setSocketError(mapConnectionError("typing-race", msg));
          setConnected(false);
          setSocketLifecycle("FAILED");
        },
        onReconnect: (s) => {
          if (cancelled) return;
          lastConnectErrorRef.current = null;
          authenticatedRef.current = true;
          setConnected(s.connected);
          setSocketError(null);
          setSocketLifecycle("AUTHENTICATED");
          scheduleResync(s);
        },
        onReconnectFailed: () => {
          if (cancelled) return;
          setSocketError(SESSION_EXPIRED_MESSAGE);
          setConnected(false);
          setSocketLifecycle("FAILED");
        },
        onVisibilityResync: (s) => {
          scheduleResync(s);
        },
      });
      if (cancelled) {
        cleanup();
        return undefined;
      }
      socket = gameSocket;
      socketRef.current = socket;
      socketCleanup = cleanup;

      socket.on("typing_room_updated", onRoom);
      socket.on("typing_countdown_started", onRoom);
      socket.on("typing_race_started", onRoom);
      socket.on("typing_peer_progress", (payload) => {
        const now = Date.now();
        eventRateRef.current.peerProgress += 1;
        if (now - eventRateRef.current.tickAt >= 1000) {
          if (DEV && eventRateRef.current.peerProgress > 30) {
            console.warn("[TypingRace] high peer progress rate:", eventRateRef.current.peerProgress, "events/s");
          }
          eventRateRef.current.tickAt = now;
          eventRateRef.current.peerProgress = 0;
        }
        const uid = payload?.userId;
        if (!uid) {
          return;
        }
        setRoom((prev) => {
          if (!prev || !Array.isArray(prev.players)) {
            return prev;
          }
          let changed = false;
          const next = {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === uid
                ? (() => {
                    const nextCursorDisplay = payload.cursorDisplay;
                    const nextWpm = payload.wpm;
                    const nextProgress01 = payload.progress01;
                    if (
                      p.cursorDisplay === nextCursorDisplay &&
                      p.wpm === nextWpm &&
                      p.progress01 === nextProgress01
                    ) {
                      return p;
                    }
                    changed = true;
                    return {
                    ...p,
                    cursorDisplay: nextCursorDisplay,
                    wpm: nextWpm,
                    progress01: nextProgress01,
                  };
                  })()
                : p,
            ),
          };
          return changed ? next : prev;
        });
      });
      socket.on("typing_player_finished", onRoom);
      socket.on("typing_race_finished", onRoom);
    } catch (e) {
      if (!cancelled) {
        const msg =
          e instanceof ApiError
            ? mapConnectionError("typing-race", e.user_message || e.message)
            : mapConnectionError("typing-race", e);
        setSocketError(msg);
        setSocketLifecycle("FAILED");
      }
    }

    return () => {
      cancelled = true;
      if (resyncDebounceRef.current) {
        clearTimeout(resyncDebounceRef.current);
        resyncDebounceRef.current = null;
      }
      authenticatedRef.current = false;
      socketCleanup?.();
      socketRef.current = null;
      setConnected(false);
      setRoom(null);
      setSocketLifecycle("DISCONNECTED");
    };
  }, [authLoading, userId, applyRoom]);

  const serverNow = useCallback(
    () => Date.now() + serverOffsetMs,
    [serverOffsetMs],
  );

  const createRoom = useCallback(async () => {
    const result = await emitAck("typing_create_room", {});
    if (result.ok && result.data?.room) {
      applyRoom(result.data.room);
    }
    return result;
  }, [applyRoom, emitAck]);

  const joinRoom = useCallback(
    async (rawCode) => {
      const digits = String(rawCode ?? "").replace(/\D/g, "");
      const result = await emitAck("typing_join_room", {
        roomCode: digits,
      });
      if (result.ok && result.data?.room) {
        applyRoom(result.data.room);
      }
      return result;
    },
    [applyRoom, emitAck],
  );

  const leaveRoom = useCallback(async () => {
    const result = await emitAck("typing_leave_room", {});
    setRoom(null);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(TYPING_ROOM_STORAGE_KEY);
    }
    return result;
  }, [emitAck]);

  const setReady = useCallback(
    async (ready) => {
      return emitAck("typing_set_ready", { ready });
    },
    [emitAck],
  );

  const startCountdown = useCallback(async () => {
    return emitAck("typing_start_countdown", {});
  }, [emitAck]);

  const sendProgress = useCallback(
    async (payload) => {
      return emitAck("typing_progress_update", payload);
    },
    [emitAck],
  );

  const finishRace = useCallback(async (stats) => {
    return emitAck("typing_finish", stats ? { stats } : {});
  }, [emitAck]);

  const reportSoloComplete = useCallback(async (stats) => {
    return emitAck("typing_solo_complete", stats);
  }, [emitAck]);

  const forceEnd = useCallback(async () => {
    return emitAck("typing_force_end", {});
  }, [emitAck]);

  const resetLobby = useCallback(async () => {
    return emitAck("typing_reset_lobby", {});
  }, [emitAck]);

  const value = useMemo(
    () => ({
      room,
      connected,
      isConnecting,
      socketLifecycle,
      serverNow,
      serverOffsetMs,
      socketError,
      typingRaceUserFacingError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      startCountdown,
      sendProgress,
      finishRace,
      reportSoloComplete,
      forceEnd,
      resetLobby,
      router,
    }),
    [
      room,
      connected,
      isConnecting,
      socketLifecycle,
      serverNow,
      serverOffsetMs,
      socketError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      startCountdown,
      sendProgress,
      finishRace,
      reportSoloComplete,
      forceEnd,
      resetLobby,
      router,
    ],
  );

  return (
    <TypingRaceContext.Provider value={value}>{children}</TypingRaceContext.Provider>
  );
}

export function useTypingRace() {
  const v = useContext(TypingRaceContext);
  if (!v) {
    throw new Error("useTypingRace outside TypingRaceProvider");
  }
  return v;
}
