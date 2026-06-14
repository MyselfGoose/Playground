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
import { connectGameSocket } from "../socket/createGameSocket.js";
import { useGameSession } from "../session/GameSessionContext.jsx";
import { persistLastRoomCode, clearLastRoomCode } from "../session/RoomSession.js";
import { ackToResult, ACK_TIMEOUT_MS } from "../socket/socketUtils.js";
import {
  connectionMessage,
  mapConnectionError,
  resolveConnectionError,
} from "../errors/mapConnectionError.js";

const TypingRaceContext = createContext(null);

/**
 * Performance note (Phase 17): peer progress uses `typing_peer_progress` partial updates;
 * full `room` snapshots still rerender all context consumers. Splitting progress into a
 * separate context is deferred until React Profiler shows MultiRaceTrack-bound work as
 * a hotspot — see performance-budgets.md.
 */

const DEV = process.env.NODE_ENV !== "production";

const TYPING_ROOM_STORAGE_KEY = "playground:typing-race:last-room-code";
const TYPING_ROOM_STORAGE_KEY_LEGACY = "playgrounds:typing-race:last-room-code";

function readStoredTypingRoomCode() {
  if (typeof sessionStorage === "undefined") {
    return "";
  }
  const fromNew = sessionStorage.getItem(TYPING_ROOM_STORAGE_KEY);
  if (fromNew) {
    return fromNew;
  }
  const legacy = sessionStorage.getItem(TYPING_ROOM_STORAGE_KEY_LEGACY);
  if (legacy) {
    sessionStorage.setItem(TYPING_ROOM_STORAGE_KEY, legacy);
    sessionStorage.removeItem(TYPING_ROOM_STORAGE_KEY_LEGACY);
  }
  return legacy ?? "";
}

function writeStoredTypingRoomCode(digits) {
  sessionStorage.setItem(TYPING_ROOM_STORAGE_KEY, digits);
}

function clearStoredTypingRoomCode() {
  sessionStorage.removeItem(TYPING_ROOM_STORAGE_KEY);
  sessionStorage.removeItem(TYPING_ROOM_STORAGE_KEY_LEGACY);
}

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
    return resolveConnectionError("typing-race", detail || e).message;
  }
  if (code === "ACK_TIMEOUT") {
    return resolveConnectionError("typing-race", e, { phase: "timeout" }).message;
  }
  if (code === "EMIT_FAILED") {
    return resolveConnectionError("typing-race", e.message || e).message;
  }
  if (code === "SOCKET_NOT_AUTHENTICATED") {
    return resolveConnectionError("typing-race", e, { phase: "reconnect" }).message;
  }
  return resolveConnectionError("typing-race", e.message || e).message;
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
  const { holdActive } = useGameSession();
  const userId = user?.id ?? "";
  const router = useRouter();
  const [room, setRoom] = useState(/** @type {RoomSnap} */ (null));
  const [connected, setConnected] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [socketError, setSocketError] = useState(
    /** @type {string | null} */ (!getSocketBase() ? connectionMessage("typing-race", "missing_socket_url") : null),
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    /** @type {string | null} */ (!getSocketBase() ? "MISSING_SOCKET_URL" : null),
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));
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

  const roomVersionRef = useRef(0);

  const applyRoom = useCallback((r) => {
    if (r && typeof r === "object") {
      const incoming = /** @type {any} */ (r);
      const incomingVersion = typeof incoming.stateVersion === "number" ? incoming.stateVersion : 0;
      if (incomingVersion > 0 && incomingVersion < roomVersionRef.current) {
        return;
      }
      roomVersionRef.current = incomingVersion;
      const sn = incoming.serverNow;
      if (typeof sn === "number") {
        setServerOffsetMs(sn - Date.now());
      }
      const rc = incoming.roomCode;
      if (typeof rc === "string" && typeof sessionStorage !== "undefined") {
        const digits = rc.replace(/\D/g, "");
        if (digits.length >= 4) {
          writeStoredTypingRoomCode(digits);
          persistLastRoomCode("typing-race", digits, user?.id);
        }
      }
      setRoom(r);
    } else {
      roomVersionRef.current = 0;
      setRoom(null);
    }
  }, [user?.id]);

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
            error: Object.assign(
              new Error(resolveConnectionError("typing-race", detail).message),
              {
                code: "NOT_CONNECTED",
                connectDetail: detail,
              },
            ),
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
    if (!userId && !holdActive) {
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
        const digits = String(readStoredTypingRoomCode()).replace(/\D/g, "");
        if (digits.length < 4) return;
        s.timeout(ACK_TIMEOUT_MS).emit("typing_join_room", { roomCode: digits }, (err, res) => {
          if (err || !res?.ok || !res?.data?.room) {
            clearStoredTypingRoomCode();
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
          setSocketErrorCode(null);
          setSocketLifecycle("AUTHENTICATED");
          scheduleResync(s);
        },
        onDisconnect: () => {
          if (cancelled) return;
          authenticatedRef.current = false;
          setConnected(false);
          setSocketLifecycle("RECONNECTING");
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          authenticatedRef.current = false;
          lastConnectErrorRef.current = msg;
          const mapped = mapConnectionError("typing-race", msg);
          setSocketError(mapped.message);
          setSocketErrorCode(mapped.code);
          setConnected(false);
          setSocketLifecycle("FAILED");
        },
        onReconnect: (s) => {
          if (cancelled) return;
          lastConnectErrorRef.current = null;
          authenticatedRef.current = true;
          setConnected(s.connected);
          setSocketError(null);
          setSocketErrorCode(null);
          setReconnectedAt(Date.now());
          setSocketLifecycle("AUTHENTICATED");
          scheduleResync(s);
        },
        onReconnectFailed: () => {
          if (cancelled) return;
          setSocketError(connectionMessage("typing-race", "connection_lost"));
          setSocketErrorCode("CONNECTION_LOST");
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

      const onKicked = () => {
        if (cancelled) {
          return;
        }
        clearStoredTypingRoomCode();
        clearLastRoomCode("typing-race", user?.id);
        roomVersionRef.current = 0;
        setRoom(null);
        router.push("/games/typing-race/multi");
      };
      socket.on("typing_kicked", onKicked);
    } catch (e) {
      if (!cancelled) {
        const mapped =
          e instanceof ApiError
            ? mapConnectionError("typing-race", e.user_message || e.message)
            : mapConnectionError("typing-race", e);
        setSocketError(mapped.message);
        setSocketErrorCode(mapped.code);
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
      setReconnectedAt(null);
      setRoom(null);
      setSocketLifecycle("DISCONNECTED");
    };
  }, [authLoading, userId, holdActive, applyRoom, router]);

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
    roomVersionRef.current = 0;
    if (typeof sessionStorage !== "undefined") {
      clearStoredTypingRoomCode();
      clearLastRoomCode("typing-race", user?.id);
    }
    return result;
  }, [emitAck, user?.id]);

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
    const result = await emitAck("typing_reset_lobby", {});
    if (result.ok && result.data?.room) {
      applyRoom(result.data.room);
    }
    return result;
  }, [emitAck, applyRoom]);

  const kickPlayer = useCallback(
    async (targetUserId) => {
      return emitAck("typing_kick_player", { targetUserId });
    },
    [emitAck],
  );

  const retryConnection = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const value = useMemo(
    () => ({
      room,
      connected,
      isConnecting,
      socketLifecycle,
      serverNow,
      serverOffsetMs,
      socketError,
      socketErrorCode,
      reconnectedAt,
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
      kickPlayer,
      retryConnection,
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
      socketErrorCode,
      reconnectedAt,
      retryConnection,
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
      kickPlayer,
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
