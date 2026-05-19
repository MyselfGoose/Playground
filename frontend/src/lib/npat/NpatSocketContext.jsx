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
import { usePathname } from "next/navigation";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { formatJoinCodeForServer } from "./roomCode.js";
import { connectGameSocket } from "../socket/createGameSocket.js";
import { emitAck } from "../socket/socketUtils.js";
import { SESSION_EXPIRED_MESSAGE } from "../session/sessionInvalidation.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

/** @typedef {Record<string, unknown> | null} RoomSnapshot */

const NpatContext = createContext(null);

export function NpatProvider({ children }) {
  const { user, loading: authLoading } = useUser();
  const pathname = usePathname();

  const [room, setRoom] = useState(/** @type {RoomSnapshot} */ (null));
  const [evaluationSource, setEvaluationSource] = useState(
    /** @type {'gemini' | 'fallback' | null} */ (null),
  );
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState(
    /** @type {'connected' | 'reconnecting' | 'disconnected'} */ ("disconnected"),
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));
  const [resumedCode, setResumedCode] = useState(/** @type {string | null} */ (null));
  const [socketError, setSocketErrorState] = useState(
    /** @type {string | null} */ (!getSocketBase() ? connectionMessage("npat", "missing_socket_url") : null),
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    /** @type {string | null} */ (!getSocketBase() ? "MISSING_SOCKET_URL" : null),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));

  const roomVersionRef = useRef(0);

  const applyRoom = useCallback((r) => {
    if (!r || typeof r !== "object") {
      setRoom(null);
      setEvaluationSource(null);
      return;
    }
    const nextVersion = Number(r.stateVersion || 0);
    const prevVersion = roomVersionRef.current;
    if (nextVersion > 0 && nextVersion < prevVersion) return;
    if (nextVersion > 0) roomVersionRef.current = nextVersion;
    const results = r.results;
    if (
      results &&
      typeof results === "object" &&
      (results.evaluationSource === "gemini" || results.evaluationSource === "fallback")
    ) {
      setEvaluationSource(results.evaluationSource);
    }
    setRoom(r);
  }, []);

  const applyEvaluatedPayload = useCallback(
    (payload) => {
      const src = payload?.evaluationSource ?? payload?.source;
      if (src === "gemini" || src === "fallback") {
        setEvaluationSource(src);
      }
      if (payload?.room) {
        applyRoom({
          ...payload.room,
          results: payload.results ?? payload.room?.results,
        });
      }
    },
    [applyRoom],
  );

  // Route-scoped socket error: clear whenever the path changes so a stale error from /lobby
  // does not leak into /play or /result.
  useEffect(() => {
    setSocketErrorState((prev) => (socketErrorCode === "MISSING_SOCKET_URL" ? prev : null));
    setSocketErrorCode((prev) => (prev === "MISSING_SOCKET_URL" ? prev : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const resyncRoom = useCallback(
    (socket) => {
      void emitAck(socket, "get_room_state", {}).then((result) => {
        if (result.ok && result.data?.room) applyRoom(result.data.room);
      });
    },
    [applyRoom],
  );

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) return undefined;
    if (!getSocketBase()) return undefined;

    let cancelled = false;
    /** @type {(() => void) | null} */
    let cleanup = null;

    try {
      const { socket, cleanup: socketCleanup } = connectGameSocket({
        namespace: "/npat",
        gameTag: "npat",
        onConnect: (socket) => {
          if (cancelled) return;
          setConnected(true);
          setConnectionState("connected");
          setSocketErrorState(null);
          setSocketErrorCode(null);
          resyncRoom(socket);
        },
        onDisconnect: () => {
          if (cancelled) return;
          setConnected(false);
          setConnectionState("reconnecting");
        },
        onReconnect: (socket) => {
          if (cancelled) return;
          setConnected(true);
          setConnectionState("connected");
          setReconnectedAt(Date.now());
          resyncRoom(socket);
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          const mapped = mapConnectionError("npat", msg);
          setSocketErrorState(mapped.message);
          setSocketErrorCode(mapped.code);
          setConnected(false);
          setConnectionState("reconnecting");
        },
        onReconnectFailed: () => {
          if (cancelled) return;
          setSocketErrorState(SESSION_EXPIRED_MESSAGE);
          setSocketErrorCode("SESSION_EXPIRED");
          setConnected(false);
          setConnectionState("disconnected");
          setRoom((prev) =>
            prev?.state === "FINISHED" || prev?.state === "EVALUATING" ? prev : null,
          );
        },
        onVisibilityResync: resyncRoom,
      });
      if (cancelled) {
        socketCleanup();
        return undefined;
      }

      socketRef.current = socket;
      cleanup = socketCleanup;

      const onRoomPayload = (payload) => {
        if (payload?.room) applyRoom(payload.room);
      };

      socket.on("room_update", onRoomPayload);
      socket.on("game_started", onRoomPayload);
      socket.on("round_started", onRoomPayload);
      socket.on("timer_started", onRoomPayload);
      socket.on("round_ended", onRoomPayload);
      socket.on("game_evaluated", applyEvaluatedPayload);
      socket.on("game_finished", applyEvaluatedPayload);
      socket.on("session_resumed", (payload) => {
        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("npat_suppress_resume") === "1"
        ) {
          return;
        }
        if (payload?.room) {
          applyRoom(payload.room);
          const code = typeof payload.room.code === "string" ? payload.room.code : null;
          if (code) setResumedCode(code);
        }
      });
    } catch {
      if (!cancelled) {
        setSocketErrorState(connectionMessage("npat", "missing_socket_url"));
        setSocketErrorCode("MISSING_SOCKET_URL");
      }
      return undefined;
    }

    return () => {
      cancelled = true;
      cleanup?.();
      socketRef.current = null;
      setConnected(false);
      setConnectionState("disconnected");
      setReconnectedAt(null);
      setRoom(null);
      setEvaluationSource(null);
      setResumedCode(null);
    };
  }, [authLoading, user?.id, applyRoom, applyEvaluatedPayload, resyncRoom]);

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

  const retryConnection = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const createRoom = useCallback(
    async (mode) => {
      const result = await emitAck(socketRef.current, "create_room", { mode });
      if (result.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("npat_suppress_resume");
        }
        applyRoom(result.data?.room ?? null);
      }
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
      if (result.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("npat_suppress_resume");
        }
        applyRoom(result.data?.room ?? null);
      }
      return result;
    },
    [applyRoom],
  );

  const leaveRoom = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setRoom(null);
      setEvaluationSource(null);
      setResumedCode(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("npat_suppress_resume", "1");
      }
      return { ok: true, data: { left: true } };
    }
    const result = await emitAck(socket, "leave_room", null);
    setRoom(null);
    setEvaluationSource(null);
    setResumedCode(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("npat_suppress_resume", "1");
    }
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
      evaluationSource,
      connected,
      connectionState,
      reconnectedAt,
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
      retryConnection,
      localUserId: user?.id ?? null,
    }),
    [
      room,
      evaluationSource,
      connected,
      connectionState,
      reconnectedAt,
      retryConnection,
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

  return <NpatContext.Provider value={value}>{children}</NpatContext.Provider>;
}

export function useNpat() {
  const ctx = useContext(NpatContext);
  if (!ctx) {
    throw new Error("useNpat must be used within NpatProvider");
  }
  return ctx;
}
