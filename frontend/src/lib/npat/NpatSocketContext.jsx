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

/** @typedef {Record<string, unknown> | null} RoomSnapshot */

const NpatContext = createContext(null);

export function NpatProvider({ children }) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [room, setRoom] = useState(/** @type {RoomSnapshot} */ (null));
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState(
    /** @type {string | null} */ (!API_BASE ? "Set NEXT_PUBLIC_API_URL to your API origin (e.g. http://localhost:4000)." : null),
  );
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */ (null));

  const applyRoom = useCallback((r) => {
    setRoom(r && typeof r === "object" ? r : null);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent("/games/npat")}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      return undefined;
    }
    if (!API_BASE) {
      return undefined;
    }

    const socket = io(`${API_BASE}/npat`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socketRef.current = socket;

    const onRoomPayload = (payload) => {
      if (payload?.room) {
        applyRoom(payload.room);
      }
    };

    socket.on("connect", () => {
      setConnected(true);
      setSocketError(null);
    });
    socket.on("disconnect", () => {
      setConnected(false);
    });
    socket.on("connect_error", (err) => {
      setSocketError(err?.message ?? "Could not connect");
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
    socket.on("error", (payload) => {
      const msg =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String(payload.message)
          : "Socket error";
      setSocketError(msg);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoom(null);
    };
  }, [authLoading, user, applyRoom]);

  const createRoom = useCallback((mode) => {
    setSocketError(null);
    socketRef.current?.emit("create_room", { mode });
  }, []);

  const joinRoom = useCallback((code) => {
    setSocketError(null);
    socketRef.current?.emit("join_room", { code: String(code).replace(/\D/g, "") });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave_room");
    setRoom(null);
  }, []);

  const setReady = useCallback((ready) => {
    socketRef.current?.emit("set_ready", { ready });
  }, []);

  const switchTeam = useCallback((teamId) => {
    socketRef.current?.emit("switch_team", { teamId });
  }, []);

  const startGame = useCallback(() => {
    setSocketError(null);
    socketRef.current?.emit("start_game", {});
  }, []);

  const submitField = useCallback((field, value) => {
    socketRef.current?.emit("submit_field", { field, value });
  }, []);

  const value = useMemo(
    () => ({
      room,
      connected,
      socketError,
      setSocketError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      localUserId: user?.id ?? null,
    }),
    [
      room,
      connected,
      socketError,
      createRoom,
      joinRoom,
      leaveRoom,
      setReady,
      switchTeam,
      startGame,
      submitField,
      user?.id,
    ],
  );

  if (!authLoading && !user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Redirecting to sign in…
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Loading…
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
