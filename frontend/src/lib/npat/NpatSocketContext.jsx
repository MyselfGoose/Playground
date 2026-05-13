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
import { getSocketBase, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { formatJoinCodeForServer } from "./roomCode.js";
import { emitAck, fetchAdmissionToken as fetchAdmission } from "../socket/socketUtils.js";

/** @typedef {Record<string, unknown> | null} RoomSnapshot */

const NpatContext = createContext(null);

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
      !getSocketBase()
        ? "Set NEXT_PUBLIC_SOCKET_URL or NEXT_PUBLIC_API_URL (e.g. http://localhost:4000)."
        : null
    ),
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    /** @type {string | null} */ (!getSocketBase() ? "MISSING_SOCKET_URL" : null),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));

  const applyRoom = useCallback((r) => {
    setRoom(r && typeof r === "object" ? r : null);
  }, []);

  // Route-scoped socket error: clear whenever the path changes so a stale error from /lobby
  // does not leak into /play or /result.
  useEffect(() => {
    setSocketErrorState((prev) => (socketErrorCode === "MISSING_SOCKET_URL" ? prev : null));
    setSocketErrorCode((prev) => (prev === "MISSING_SOCKET_URL" ? prev : null));
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
    const sockBase = getSocketBase();
    if (!sockBase) return undefined;

    let cancelled = false;
    /** @type {import('socket.io-client').Socket | null} */
    let socket = null;

    const fetchAdmissionToken = () => fetchAdmission(apiFetch);

    (async () => {
      let token;
      try {
        token = await fetchAdmissionToken();
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.user_message || e.message
            : "Could not prepare multiplayer session. Sign in again and confirm the API is reachable.";
        setSocketErrorState(msg);
        setSocketErrorCode("ADMISSION_FAILED");
        return;
      }
      if (cancelled || !token) return;

      socket = io(`${sockBase}/npat`, {
        path: "/socket.io",
        withCredentials: true,
        auth: { token },
        transports: ["polling", "websocket"],
        autoConnect: true,
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 5000,
      });
      if (cancelled) { socket.disconnect(); return; }
      socketRef.current = socket;

      socket.io.on("reconnect_attempt", async () => {
        try {
          const fresh = await fetchAdmissionToken();
          socket.auth = { token: fresh };
        } catch {
          dispatchReconcile("npat_admission_refresh_failed");
        }
      });

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
        setRoom((prev) =>
          prev?.state === "FINISHED" || prev?.state === "EVALUATING" ? prev : null,
        );
      });
      socket.on("connect_error", async (err) => {
        const msg = err?.message ?? "Could not connect";
        if (msg === "UNAUTHENTICATED" || msg === "SESSION_REVOKED") {
          try {
            await apiFetch("/api/v1/auth/refresh", { method: "POST" });
            const fresh = await fetchAdmissionToken();
            socket.auth = { token: fresh };
            socket.connect();
            return;
          } catch {
            dispatchReconcile("refresh_failed");
          }
        }
        setSocketErrorState(msg);
        setSocketErrorCode("CONNECT_ERROR");
        setConnected(false);
      });
      socket.on("reconnect", () => {
        dispatchReconcile("npat_reconnected");
      });
      socket.on("room_update", onRoomPayload);
      socket.on("game_started", onRoomPayload);
      socket.on("round_started", onRoomPayload);
      socket.on("timer_started", onRoomPayload);
      socket.on("round_ended", onRoomPayload);
      socket.on("game_evaluated", onRoomPayload);
      socket.on("game_finished", (payload) => {
        if (payload?.room) {
          applyRoom({
            ...payload.room,
            results: payload.results ?? payload.room?.results,
          });
        }
      });
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

      const onVisibilityChange = () => {
        if (document.visibilityState === "visible" && socket?.connected) {
          emitAck(socket, "get_room_state", {}).then((result) => {
            if (result.ok && result.data?.room) applyRoom(result.data.room);
          });
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      socket.__visCleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);
    })();

    return () => {
      cancelled = true;
      if (socket) {
        if (socket.__visCleanup) socket.__visCleanup();
        socket.removeAllListeners();
        socket.disconnect();
      }
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
      setResumedCode(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("npat_suppress_resume", "1");
      }
      return { ok: true, data: { left: true } };
    }
    const result = await emitAck(socket, "leave_room", null);
    setRoom(null);
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
