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
import { useGameSession } from "../session/GameSessionContext.jsx";
import { formatJoinCodeForServer } from "./roomCode.js";
import { emitAck } from "../socket/socketUtils.js";
import { useGameSocket } from "../socket/useGameSocket.js";
import {
  clearResumeSuppress,
  isResumeSuppressed,
  persistLastRoomCode,
  setResumeSuppressed,
} from "../session/RoomSession.js";
import { useActiveGameRoom } from "../session/useActiveGameRoom.js";
import { clearActiveGameRoom } from "../session/useActiveGameRoom.js";

/** @typedef {Record<string, unknown> | null} RoomSnapshot */

const NpatContext = createContext(null);

/**
 * @param {Record<string, unknown> | null} incoming
 * @param {{ setRoom: (r: Record<string, unknown> | null) => void, roomVersionRef: React.MutableRefObject<number>, setEvaluationSource: (s: 'gemini' | 'fallback' | null) => void }} ctx
 */
function mergeNpatRoom(incoming, { setRoom, roomVersionRef, setEvaluationSource }) {
  if (!incoming || typeof incoming !== "object") {
    setRoom(null);
    setEvaluationSource(null);
    return;
  }
  const nextVersion = Number(incoming.stateVersion || 0);
  const prevVersion = roomVersionRef.current;
  if (prevVersion > 0 && nextVersion === 0) return;
  if (nextVersion > 0 && nextVersion < prevVersion) return;
  if (nextVersion > 0) roomVersionRef.current = nextVersion;
  const results = incoming.results;
  if (
    results &&
    typeof results === "object" &&
    (results.evaluationSource === "gemini" || results.evaluationSource === "fallback")
  ) {
    setEvaluationSource(results.evaluationSource);
  }
  setRoom(incoming);
}

export function NpatProvider({ children }) {
  const { user, loading: authLoading } = useUser();
  const { holdActive } = useGameSession();
  const pathname = usePathname();
  const [evaluationSource, setEvaluationSource] = useState(
    /** @type {'gemini' | 'fallback' | null} */ (null),
  );
  const [resumedCode, setResumedCode] = useState(/** @type {string | null} */ (null));

  const mergeWithEval = useCallback(
    (incoming, ctx) => mergeNpatRoom(incoming, { ...ctx, setEvaluationSource }),
    [],
  );

  /** @type {React.MutableRefObject<(() => void) | null>} */
  const onReconnectFailedRef = useRef(null);

  const shouldAcceptSessionResumed = useCallback(() => {
    if (typeof window === "undefined") return true;
    return !isResumeSuppressed("npat");
  }, []);

  const onSessionResumedExtra = useCallback((payload) => {
    const code = typeof payload?.room?.code === "string" ? payload.room.code : null;
    if (code && user?.id) {
      setResumedCode(code);
      persistLastRoomCode("npat", code, user.id);
    }
  }, [user?.id]);

  const onReconnectFailedExtra = useCallback(() => {
    onReconnectFailedRef.current?.();
  }, []);

  const socket = useGameSocket({
    namespace: "/npat",
    gameTag: "npat",
    mapGame: "npat",
    enabled: Boolean(!authLoading && getSocketBase() && (user?.id || holdActive)),
    mergeRoom: mergeWithEval,
    shouldAcceptSessionResumed,
    onSessionResumedExtra,
    onReconnectFailedExtra,
  });

  useEffect(() => {
    onReconnectFailedRef.current = () => {
      socket.setRoom((prev) => {
        if (prev?.state === "FINISHED" || prev?.state === "EVALUATING") return prev;
        socket.resetRoomState();
        return null;
      });
    };
  }, [socket.setRoom, socket.resetRoomState]);

  const applyRoom = socket.applyRoom;

  const applyEvaluatedPayload = useCallback(
    (payload) => {
      const p = /** @type {{ evaluationSource?: string, source?: string, room?: Record<string, unknown>, results?: unknown }} */ (
        payload
      );
      const src = p?.evaluationSource ?? p?.source;
      if (src === "gemini" || src === "fallback") {
        setEvaluationSource(src);
      }
      if (p?.room) {
        applyRoom({
          ...p.room,
          results: p.results ?? p.room?.results,
        });
      }
    },
    [applyRoom],
  );

  useEffect(() => {
    const s = socket.socketRef.current;
    if (!s || !socket.connected) return undefined;

    const onRoomPayload = (payload) => {
      const p = /** @type {{ room?: Record<string, unknown> }} */ (payload);
      if (p?.room) applyRoom(p.room);
    };

    const phaseEvents = ["game_started", "round_started", "timer_started", "round_ended"];
    for (const event of phaseEvents) {
      s.on(event, onRoomPayload);
    }
    s.on("game_evaluated", applyEvaluatedPayload);
    s.on("game_finished", applyEvaluatedPayload);

    return () => {
      for (const event of phaseEvents) {
        s.off(event, onRoomPayload);
      }
      s.off("game_evaluated", applyEvaluatedPayload);
      s.off("game_finished", applyEvaluatedPayload);
    };
  }, [socket.connected, applyRoom, applyEvaluatedPayload, socket.socketRef]);

  const clearSocketError = useCallback(() => {
    socket.setSocketError(null, null);
  }, [socket.setSocketError]);

  useEffect(() => {
    if (socket.socketErrorCode !== "MISSING_SOCKET_URL") {
      clearSocketError();
    }
  }, [pathname, clearSocketError, socket.socketErrorCode]);

  const setSocketError = useCallback(
    (msg, code) => {
      socket.setSocketError(
        msg == null ? null : typeof msg === "string" ? msg : msg?.message ?? "Unknown error",
        typeof code === "string" ? code : null,
      );
    },
    [socket.setSocketError],
  );

  const npatRoomCode = /** @type {string | null} */ (socket.room?.code ?? null);
  useActiveGameRoom("npat", npatRoomCode);

  useEffect(() => {
    if (!user?.id) return;
    clearResumeSuppress("npat");
  }, [user?.id]);

  const clearResumedCode = useCallback(() => setResumedCode(null), []);

  const createRoom = useCallback(
    async (mode) => {
      const result = await emitAck(socket.socketRef.current, "create_room", { mode });
      if (result.ok) {
        clearResumeSuppress("npat");
        applyRoom(/** @type {Record<string, unknown> | null} */ (result.data?.room ?? null));
      }
      return result;
    },
    [applyRoom, socket.socketRef],
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
      const result = await emitAck(socket.socketRef.current, "join_room", { code });
      if (result.ok) {
        clearResumeSuppress("npat");
        applyRoom(/** @type {Record<string, unknown> | null} */ (result.data?.room ?? null));
      }
      return result;
    },
    [applyRoom, socket.socketRef],
  );

  const leaveRoom = useCallback(async () => {
    const s = socket.socketRef.current;
    if (!s?.connected) {
      socket.resetRoomState();
      setEvaluationSource(null);
      setResumedCode(null);
      setResumeSuppressed("npat", true);
      clearActiveGameRoom("npat", user?.id);
      return { ok: true, data: { left: true } };
    }
    const result = await emitAck(s, "leave_room", null);
    socket.resetRoomState();
    setEvaluationSource(null);
    setResumedCode(null);
    setResumeSuppressed("npat", true);
    clearActiveGameRoom("npat", user?.id);
    return result;
  }, [socket.resetRoomState, socket.socketRef, user?.id]);

  const resetRoom = useCallback(
    () => emitAck(socket.socketRef.current, "reset_room", {}),
    [socket.socketRef],
  );

  const setReady = useCallback(
    (ready) => emitAck(socket.socketRef.current, "set_ready", { ready }),
    [socket.socketRef],
  );

  const switchTeam = useCallback(
    (teamId) => emitAck(socket.socketRef.current, "switch_team", { teamId }),
    [socket.socketRef],
  );

  const startGame = useCallback(
    () => emitAck(socket.socketRef.current, "start_game", {}),
    [socket.socketRef],
  );

  const submitField = useCallback(
    (field, value) => emitAck(socket.socketRef.current, "submit_field", { field, value }),
    [socket.socketRef],
  );

  const proposeEarlyFinish = useCallback(
    () => emitAck(socket.socketRef.current, "propose_early_finish", {}),
    [socket.socketRef],
  );

  const voteEarlyFinish = useCallback(
    (accept) => emitAck(socket.socketRef.current, "vote_early_finish", { accept }),
    [socket.socketRef],
  );

  const value = useMemo(
    () => ({
      room: socket.room,
      evaluationSource,
      connected: socket.connected,
      connectionState: socket.connectionState,
      reconnectedAt: socket.reconnectedAt,
      resumedCode,
      clearResumedCode,
      socketError: socket.socketError,
      socketErrorCode: socket.socketErrorCode,
      setSocketError,
      clearSocketError,
      createRoom,
      joinRoom,
      leaveRoom,
      resetRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      proposeEarlyFinish,
      voteEarlyFinish,
      retryConnection: socket.retryConnection,
      localUserId: user?.id ?? null,
      applyRoom,
    }),
    [
      socket.room,
      evaluationSource,
      socket.connected,
      socket.connectionState,
      socket.reconnectedAt,
      resumedCode,
      clearResumedCode,
      socket.socketError,
      socket.socketErrorCode,
      setSocketError,
      clearSocketError,
      createRoom,
      joinRoom,
      leaveRoom,
      resetRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      proposeEarlyFinish,
      voteEarlyFinish,
      socket.retryConnection,
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
