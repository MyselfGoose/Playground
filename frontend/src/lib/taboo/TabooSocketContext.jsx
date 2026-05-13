"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getSocketBase, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { emitAck, fetchAdmissionToken as fetchAdmission } from "../socket/socketUtils.js";

const TabooContext = createContext(null);

export function TabooProvider({ children }) {
  const { user, loading } = useUser();
  const [room, setRoom] = useState(null);
  const [categories, setCategories] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [socketError, setSocketError] = useState(
    !getSocketBase() ? "Set NEXT_PUBLIC_SOCKET_URL or NEXT_PUBLIC_API_URL." : null,
  );
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
    const sockBase = getSocketBase();
    if (loading || !user || !sockBase) return undefined;

    let cancelled = false;
    /** @type {import("socket.io-client").Socket | null} */
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
            : "Could not prepare multiplayer session. Sign in again.";
        setSocketError(msg);
        return;
      }
      if (cancelled || !token) return;

      socket = io(`${sockBase}/taboo`, {
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

      const onRoomPayload = (payload) => {
        if (payload?.room) applyRoomSnapshot(payload.room);
      };

      socket.io.on("reconnect_attempt", async () => {
        dispatchReconcile("taboo_reconnect_attempt");
        try {
          const fresh = await fetchAdmissionToken();
          socket.auth = { token: fresh };
        } catch {
          dispatchReconcile("taboo_admission_refresh_failed");
        }
      });

      socket.on("connect", () => {
        setConnectionState("connected");
        setSocketError(null);
        void emitAck(socket, "get_room_state", {}).then((result) => {
          if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
        });
      });
      socket.on("disconnect", () => setConnectionState("disconnected"));
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
        setConnectionState("reconnecting");
        setSocketError(msg);
      });
      socket.on("reconnect", () => {
        setConnectionState("connected");
        dispatchReconcile("taboo_reconnected");
      });
      socket.on("room_update", onRoomPayload);
      socket.on("session_resumed", onRoomPayload);

      const onVisibilityChange = () => {
        if (document.visibilityState === "visible" && socket?.connected) {
          void emitAck(socket, "get_room_state", {}).then((result) => {
            if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
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
