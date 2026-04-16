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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { API_BASE } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { formatJoinCodeForServer } from "./roomCode.js";

/** @typedef {Record<string, unknown> | null} RoomSnapshot */

const NpatContext = createContext(null);

const ACK_TIMEOUT_MS = 15_000;

/**
 * Turn a socket ack envelope into either a resolved value or a rejection carrying `{ code }`.
 * Shape contract (server-side):
 *   success: `{ ok: true, data }`
 *   failure: `{ ok: false, error: { code, message } }`
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
 * Wrap a socket emit into a Promise that resolves to `{ ok, data | error }`.
 * Never throws; the caller inspects `ok`.
 */
function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({
        ok: false,
        error: Object.assign(new Error("Not connected to game server"), {
          code: "NOT_CONNECTED",
        }),
      });
      return;
    }
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
      const result = ackToResult(err, res);
      if (result.ok) resolve({ ok: true, data: result.data });
      else resolve({ ok: false, error: result.error });
    });
  });
}

export function NpatProvider({ children }) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [room, setRoom] = useState(/** @type {RoomSnapshot} */ (null));
  const [connected, setConnected] = useState(false);
  const [resumedCode, setResumedCode] = useState(/** @type {string | null} */ (null));
  const [socketError, setSocketErrorState] = useState(
    /** @type {string | null} */ (
      !API_BASE
        ? "Set NEXT_PUBLIC_API_URL to your API origin (e.g. http://localhost:4000)."
        : null
    ),
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    /** @type {string | null} */ (!API_BASE ? "MISSING_API_BASE" : null),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));

  const applyRoom = useCallback((r) => {
    setRoom(r && typeof r === "object" ? r : null);
  }, []);

  // Route-scoped socket error: clear whenever the path changes so a stale error from /lobby
  // does not leak into /play or /result.
  useEffect(() => {
    setSocketErrorState((prev) => (socketErrorCode === "MISSING_API_BASE" ? prev : null));
    setSocketErrorCode((prev) => (prev === "MISSING_API_BASE" ? prev : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Redirect unauthenticated users to login with a deep-link back to wherever they were.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const search = searchParams.toString();
      const next = `${pathname}${search ? `?${search}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router, pathname, searchParams]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) return undefined;
    if (!API_BASE) return undefined;

    const socket = io(`${API_BASE}/npat`, {
      path: "/socket.io",
      withCredentials: true,
      // Polling first avoids Firefox/WebSocket upgrade races during fast navigation (e.g. play → result).
      transports: ["polling", "websocket"],
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    const onRoomPayload = (payload) => {
      if (payload?.room) applyRoom(payload.room);
    };

    socket.on("connect", () => {
      setConnected(true);
      setSocketErrorState(null);
      setSocketErrorCode(null);
    });
    socket.on("disconnect", () => {
      setConnected(false);
      // Keep a FINISHED room snapshot so the results route can still render while the socket reconnects.
      setRoom((prev) => (prev?.state === "FINISHED" ? prev : null));
    });
    socket.on("connect_error", (err) => {
      setSocketErrorState(err?.message ?? "Could not connect");
      setSocketErrorCode("CONNECT_ERROR");
      setConnected(false);
    });
    socket.on("room_update", onRoomPayload);
    socket.on("game_started", onRoomPayload);
    socket.on("round_started", onRoomPayload);
    socket.on("timer_started", onRoomPayload);
    socket.on("round_ended", onRoomPayload);
    socket.on("game_finished", (payload) => {
      if (payload?.room) {
        applyRoom({
          ...payload.room,
          results: payload.results ?? payload.room?.results,
        });
      }
    });
    socket.on("session_resumed", (payload) => {
      if (payload?.room) {
        applyRoom(payload.room);
        const code = typeof payload.room.code === "string" ? payload.room.code : null;
        if (code) setResumedCode(code);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoom(null);
      setResumedCode(null);
    };
  }, [authLoading, user, applyRoom]);

  const clearSocketError = useCallback(() => {
    setSocketErrorState(null);
    setSocketErrorCode(null);
  }, []);
  const setSocketError = useCallback((msg, code) => {
    if (msg == null) {
      setSocketErrorState(null);
      setSocketErrorCode(null);
      return;
    }
    setSocketErrorState(typeof msg === "string" ? msg : msg?.message ?? "Unknown error");
    setSocketErrorCode(typeof code === "string" ? code : null);
  }, []);
  const clearResumedCode = useCallback(() => setResumedCode(null), []);

  const createRoom = useCallback(
    async (mode) => {
      const result = await emitAck(socketRef.current, "create_room", { mode });
      if (result.ok) applyRoom(result.data?.room ?? null);
      return result;
    },
    [applyRoom],
  );

  const joinRoom = useCallback(
    async (rawCode) => {
      let code;
      try {
        code = formatJoinCodeForServer(rawCode);
      } catch (e) {
        return {
          ok: false,
          error: Object.assign(
            e instanceof Error ? e : new Error(String(e)),
            { code: /** @type {any} */ (e)?.code ?? "ROOM_CODE_INVALID" },
          ),
        };
      }
      const result = await emitAck(socketRef.current, "join_room", { code });
      if (result.ok) applyRoom(result.data?.room ?? null);
      return result;
    },
    [applyRoom],
  );

  const leaveRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "leave_room", null);
    setRoom(null);
    return result;
  }, []);

  const setReady = useCallback(
    (ready) => emitAck(socketRef.current, "set_ready", { ready }),
    [],
  );

  const switchTeam = useCallback(
    (teamId) => emitAck(socketRef.current, "switch_team", { teamId }),
    [],
  );

  const startGame = useCallback(
    () => emitAck(socketRef.current, "start_game", {}),
    [],
  );

  const submitField = useCallback(
    (field, value) => emitAck(socketRef.current, "submit_field", { field, value }),
    [],
  );

  const proposeEarlyFinish = useCallback(
    () => emitAck(socketRef.current, "propose_early_finish", {}),
    [],
  );

  const voteEarlyFinish = useCallback(
    (accept) => emitAck(socketRef.current, "vote_early_finish", { accept }),
    [],
  );

  const value = useMemo(
    () => ({
      room,
      connected,
      resumedCode,
      clearResumedCode,
      socketError,
      socketErrorCode,
      setSocketError,
      clearSocketError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      proposeEarlyFinish,
      voteEarlyFinish,
      localUserId: user?.id ?? null,
    }),
    [
      room,
      connected,
      resumedCode,
      clearResumedCode,
      socketError,
      socketErrorCode,
      setSocketError,
      clearSocketError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      proposeEarlyFinish,
      voteEarlyFinish,
      user?.id,
    ],
  );

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <NpatContext.Provider value={value}>{children}</NpatContext.Provider>;
}

export function useNpat() {
  const ctx = useContext(NpatContext);
  if (!ctx) {
    throw new Error("useNpat must be used within NpatProvider");
  }
  return ctx;
}
