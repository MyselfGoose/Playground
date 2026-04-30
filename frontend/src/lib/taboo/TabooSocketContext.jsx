"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../api.js";
import { useUser } from "../context/UserContext.jsx";

const TabooContext = createContext(null);
const ACK_TIMEOUT_MS = 15_000;

function ackToResult(err, res) {
  if (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    /** @type {any} */ (e).code = /** @type {any} */ (e).code ?? "ACK_TIMEOUT";
    return { ok: false, error: e };
  }
  if (!res || typeof res !== "object") {
    return { ok: false, error: Object.assign(new Error("Malformed server response"), { code: "BAD_ACK" }) };
  }
  if (res.ok === true) return { ok: true, data: res.data ?? null };
  const failure = res.error ?? {};
  return {
    ok: false,
    error: Object.assign(new Error(typeof failure.message === "string" ? failure.message : "Request failed"), { code: typeof failure.code === "string" ? failure.code : "UNKNOWN" }),
  };
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, error: Object.assign(new Error("Not connected to game server"), { code: "NOT_CONNECTED" }) });
      return;
    }
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
      const result = ackToResult(err, res);
      resolve(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
    });
  });
}

export function TabooProvider({ children }) {
  const { user, loading } = useUser();
  const [room, setRoom] = useState(null);
  const [categories, setCategories] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [socketError, setSocketError] = useState(!API_BASE ? "Set NEXT_PUBLIC_API_URL." : null);
  const socketRef = useRef(/** @type {import("socket.io-client").Socket | null} */ (null));
  const roomVersionRef = useRef(0);

  const applyRoomSnapshot = useCallback((incomingRoom) => {
    if (!incomingRoom || typeof incomingRoom !== "object") return;
    const nextVersion = Number(incomingRoom.stateVersion || 0);
    const prevVersion = Number(roomVersionRef.current || 0);
    if (nextVersion < prevVersion) return;
    roomVersionRef.current = nextVersion;
    setRoom(incomingRoom);
  }, []);

  useEffect(() => {
    if (loading || !user || !API_BASE) return undefined;
    const socket = io(`${API_BASE}/taboo`, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["polling", "websocket"],
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    const onRoomPayload = (payload) => {
      if (payload?.room) applyRoomSnapshot(payload.room);
    };
    socket.on("connect", () => {
      setConnectionState("connected");
      setSocketError(null);
      void emitAck(socket, "get_room_state", {}).then((result) => {
        if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
      });
    });
    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", (err) => {
      setConnectionState("reconnecting");
      setSocketError(err?.message ?? "Could not connect");
    });
    socket.on("reconnect", () => setConnectionState("connected"));
    socket.on("room_update", onRoomPayload);
    socket.on("session_resumed", onRoomPayload);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnectionState("disconnected");
      setRoom(null);
      roomVersionRef.current = 0;
      setCategories([]);
    };
  }, [loading, user, applyRoomSnapshot]);

  const createRoom = useCallback(async (settings) => {
    const result = await emitAck(socketRef.current, "create_room", settings ?? {});
    if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
    return result;
  }, [applyRoomSnapshot]);

  const joinRoom = useCallback(async (code) => {
    const normalized = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const result = await emitAck(socketRef.current, "join_room", { code: normalized });
    if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
    return result;
  }, [applyRoomSnapshot]);

  const leaveRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "leave_room", {});
    if (result.ok) {
      setRoom(null);
      roomVersionRef.current = 0;
    }
    return result;
  }, []);

  const getCategories = useCallback(async () => {
    const result = await emitAck(socketRef.current, "get_categories", {});
    if (result.ok) setCategories(Array.isArray(result.data?.categories) ? result.data.categories : []);
    return result;
  }, []);

  const send = useCallback((event, payload = {}) => emitAck(socketRef.current, event, payload), []);

  const value = useMemo(() => ({
    room,
    connected: connectionState === "connected",
    connectionState,
    socketError,
    localUserId: user?.id ?? null,
    localUsername: user?.username ?? "",
    categories,
    createRoom,
    joinRoom,
    leaveRoom,
    getCategories,
    setReady: (ready) => send("set_ready", { ready }),
    changeTeam: (team) => send("change_team", { team }),
    setCategories: (categoryMode, categoryIds) => send("set_categories", { categoryMode, categoryIds }),
    startGame: () => send("start_game", {}),
    startTurn: () => send("start_turn", {}),
    submitGuess: (guess) => send("submit_guess", { guess }),
    skipCard: () => send("skip_card", {}),
    tabooCalled: () => send("taboo_called", {}),
    requestReview: () => send("request_review", {}),
    dismissReview: () => send("dismiss_review", {}),
    reviewVote: (vote) => send("review_vote", { vote }),
    reviewContinue: () => send("review_continue", {}),
  }), [room, connectionState, socketError, user?.id, user?.username, categories, createRoom, joinRoom, leaveRoom, getCategories, send]);

  return <TabooContext.Provider value={value}>{children}</TabooContext.Provider>;
}

export function useTaboo() {
  const ctx = useContext(TabooContext);
  if (!ctx) throw new Error("useTaboo must be used within TabooProvider");
  return ctx;
}
