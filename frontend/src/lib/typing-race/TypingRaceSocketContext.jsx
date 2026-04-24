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
import { API_BASE, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";

const TypingRaceContext = createContext(null);

const ACK_TIMEOUT_MS = 15_000;

const NOT_CONNECTED_HELP =
  "Could not reach the typing game server. Stay signed in, refresh the page, and set NEXT_PUBLIC_API_URL to the same API origin you use for REST (no trailing /api/v1).";

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
    if (typeof detail === "string" && detail.trim()) {
      return `${detail.trim()} If this persists, set NEXT_PUBLIC_API_URL to the same API origin you use for REST, and add your page origin to CORS_ORIGIN on the API.`;
    }
    return NOT_CONNECTED_HELP;
  }
  if (code === "ACK_TIMEOUT") {
    return "The server did not respond in time. Check your connection and try again.";
  }
  if (code === "EMIT_FAILED") {
    return e.message || "Could not send the request.";
  }
  return e.message || "Request failed.";
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
  const lastConnectErrorRef = useRef(/** @type {string | null} */ (null));

  const isConnecting = !connected && !socketError;

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

  const emitAck = useCallback((event, payload) => {
    return (async () => {
      const socket = socketRef.current;
      if (!socket) {
        console.debug("[TypingRace] emitAck(%s): socketRef is null (handshake not finished)", event);
        return {
          ok: false,
          error: Object.assign(
            new Error("Multiplayer is still starting. Wait until you see \u201cConnected to server\u201d, then try again."),
            { code: "NOT_CONNECTED", connectDetail: "No socket yet" },
          ),
        };
      }
      if (!socket.connected) {
        console.debug("[TypingRace] emitAck(%s): socket exists but disconnected, reconnecting\u2026", event);
        socket.connect();
        const ok = await waitUntilSocketConnected(socket, 10_000);
        if (!ok || !socket.connected) {
          const detail = lastConnectErrorRef.current || "The server did not accept the connection in time.";
          console.debug("[TypingRace] emitAck(%s): reconnect failed \u2014 %s", event, detail);
          return {
            ok: false,
            error: Object.assign(new Error(NOT_CONNECTED_HELP), {
              code: "NOT_CONNECTED",
              connectDetail: detail,
            }),
          };
        }
      }
      console.debug("[TypingRace] emitAck(%s): emitting (socket.id=%s)", event, socket.id);
      return await new Promise((resolve) => {
        try {
          socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
            const result = ackToResult(err, res);
            if (result.ok) {
              resolve({ ok: true, data: result.data });
            } else {
              console.debug("[TypingRace] emitAck(%s): server error \u2014 %s", event, result.error?.message);
              resolve({ ok: false, error: result.error });
            }
          });
        } catch (e) {
          console.debug("[TypingRace] emitAck(%s): emit threw \u2014 %s", event, e);
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
    if (!API_BASE) {
      return undefined;
    }

    let cancelled = false;
    /** @type {import('socket.io-client').Socket | null} */
    let socket = null;

    (async () => {
      console.debug("[TypingRace] starting handshake for userId=%s", userId);
      let token;
      try {
        const json = await apiFetch("/api/v1/auth/socket-handshake");
        token = json?.data?.token;
        console.debug("[TypingRace] handshake token received");
      } catch (e) {
        if (cancelled) {
          return;
        }
        const msg =
          e instanceof ApiError
            ? e.message
            : "Could not prepare multiplayer session. Sign in again and confirm the API is reachable.";
        console.debug("[TypingRace] handshake failed: %s", msg);
        setSocketError(msg);
        return;
      }
      if (cancelled || !token) {
        if (!cancelled && !token) {
          setSocketError("Could not get a session token for multiplayer. Try signing out and back in.");
        }
        return;
      }

      console.debug("[TypingRace] creating socket to %s/typing-race", API_BASE);
      socket = io(`${API_BASE}/typing-race`, {
        path: "/socket.io",
        withCredentials: true,
        auth: { token },
        transports: ["polling", "websocket"],
        autoConnect: true,
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 5000,
      });
      if (cancelled) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      const onRoom = (payload) => {
        if (payload?.room) {
          applyRoom(payload.room);
        }
      };

      socket.on("connect", () => {
        console.debug("[TypingRace] connected (socket.id=%s)", socket.id);
        lastConnectErrorRef.current = null;
        setConnected(socket.connected);
        setSocketError(null);
      });
      socket.on("disconnect", (reason) => {
        console.debug("[TypingRace] disconnected: %s", reason);
        setConnected(false);
      });
      socket.on("connect_error", (err) => {
        const detail = err?.message ?? "Could not connect";
        console.debug("[TypingRace] connect_error: %s", detail);
        lastConnectErrorRef.current = detail;
        setSocketError(
          `${detail} If this persists, confirm the API allows this origin in CORS_ORIGIN and that cookies reach ${API_BASE || "your API"}.`,
        );
        setConnected(false);
      });
      socket.on("reconnect", () => {
        console.debug("[TypingRace] reconnected (socket.id=%s)", socket.id);
        lastConnectErrorRef.current = null;
        setConnected(socket.connected);
        setSocketError(null);
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
    })();

    return () => {
      console.debug("[TypingRace] cleanup: disconnecting socket");
      cancelled = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
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

  const finishRace = useCallback(async () => {
    return emitAck("typing_finish", {});
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
      forceEnd,
      resetLobby,
      router,
    }),
    [
      room,
      connected,
      isConnecting,
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
