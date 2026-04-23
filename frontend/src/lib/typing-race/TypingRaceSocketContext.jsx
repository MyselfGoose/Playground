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
import { io } from "socket.io-client";
import { API_BASE } from "../api.js";
import { useUser } from "../context/UserContext.jsx";

const TypingRaceContext = createContext(null);

const ACK_TIMEOUT_MS = 15_000;
const CONNECT_WAIT_MS = 12_000;

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

/**
 * @param {unknown} err
 * @param {unknown} res
 */
function ackToResult(err, res) {
  if (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    /** @type {any} */ (e).code = /** @type {any} */ (e).code ?? "ACK_TIMEOUT";
    return { ok: false, error: e };
  }
  if (!res || typeof res !== "object") {
    return {
      ok: false,
      error: Object.assign(new Error("Malformed server response"), { code: "BAD_ACK" }),
    };
  }
  if (res.ok === true) {
    return { ok: true, data: res.data ?? null };
  }
  const failure = res.error ?? {};
  const msg = typeof failure.message === "string" ? failure.message : "Request failed";
  const code = typeof failure.code === "string" ? failure.code : "UNKNOWN";
  return { ok: false, error: Object.assign(new Error(msg), { code }) };
}

/**
 * @param {import('socket.io-client').Socket | null} socket
 * @param {string} event
 * @param {unknown} payload
 */
function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({
        ok: false,
        error: Object.assign(new Error("Not connected to game server"), {
          code: "NOT_CONNECTED",
        }),
      });
      return;
    }
    void (async () => {
      try {
        if (!socket.connected) {
          const ok = await waitUntilSocketConnected(socket, CONNECT_WAIT_MS);
          if (!ok || !socket.connected) {
            resolve({
              ok: false,
              error: Object.assign(new Error("Not connected to game server"), {
                code: "NOT_CONNECTED",
              }),
            });
            return;
          }
        }
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
    })();
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
    /** @type {string | null} */ (!API_BASE ? "Set NEXT_PUBLIC_API_URL." : null),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));

  const applyRoom = useCallback((r) => {
    if (r && typeof r === "object") {
      const sn = /** @type {any} */ (r).serverNow;
      if (typeof sn === "number") {
        setServerOffsetMs(sn - Date.now());
      }
      setRoom(r);
    } else {
      setRoom(null);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }
    if (!userId) {
      return undefined;
    }
    if (!API_BASE) {
      return undefined;
    }

    const socket = io(`${API_BASE}/typing-race`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["polling", "websocket"],
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    const onRoom = (payload) => {
      if (payload?.room) {
        applyRoom(payload.room);
      }
    };

    socket.on("connect", () => {
      setConnected(socket.connected);
      setSocketError(null);
    });
    socket.on("disconnect", () => {
      setConnected(false);
    });
    socket.on("connect_error", (err) => {
      setSocketError(err?.message ?? "Could not connect");
      setConnected(false);
    });

    socket.on("typing_room_updated", onRoom);
    socket.on("typing_countdown_started", onRoom);
    socket.on("typing_race_started", onRoom);
    socket.on("typing_peer_progress", (payload) => {
      const uid = payload?.userId;
      if (!uid) {
        return;
      }
      setRoom((prev) => {
        if (!prev || !Array.isArray(prev.players)) {
          return prev;
        }
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === uid
              ? {
                  ...p,
                  cursorDisplay: payload.cursorDisplay,
                  wpm: payload.wpm,
                  progress01: payload.progress01,
                }
              : p,
          ),
        };
      });
    });
    socket.on("typing_player_finished", onRoom);
    socket.on("typing_race_finished", onRoom);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoom(null);
    };
  }, [authLoading, userId, applyRoom]);

  const serverNow = useCallback(
    () => Date.now() + serverOffsetMs,
    [serverOffsetMs],
  );

  const createRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "typing_create_room", {});
    if (result.ok && result.data?.room) {
      applyRoom(result.data.room);
    }
    return result;
  }, [applyRoom]);

  const joinRoom = useCallback(
    async (rawCode) => {
      const digits = String(rawCode ?? "").replace(/\D/g, "");
      const result = await emitAck(socketRef.current, "typing_join_room", {
        roomCode: digits,
      });
      if (result.ok && result.data?.room) {
        applyRoom(result.data.room);
      }
      return result;
    },
    [applyRoom],
  );

  const leaveRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "typing_leave_room", {});
    setRoom(null);
    return result;
  }, []);

  const setReady = useCallback(async (ready) => {
    return emitAck(socketRef.current, "typing_set_ready", { ready });
  }, []);

  const startCountdown = useCallback(async () => {
    return emitAck(socketRef.current, "typing_start_countdown", {});
  }, []);

  const sendProgress = useCallback(async (payload) => {
    return emitAck(socketRef.current, "typing_progress_update", payload);
  }, []);

  const finishRace = useCallback(async () => {
    return emitAck(socketRef.current, "typing_finish", {});
  }, []);

  const forceEnd = useCallback(async () => {
    return emitAck(socketRef.current, "typing_force_end", {});
  }, []);

  const resetLobby = useCallback(async () => {
    return emitAck(socketRef.current, "typing_reset_lobby", {});
  }, []);

  const value = useMemo(
    () => ({
      room,
      connected,
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
      forceEnd,
      resetLobby,
      router,
    }),
    [
      room,
      connected,
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
