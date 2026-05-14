"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getSocketBase, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { emitAck, fetchAdmissionToken as fetchAdmission } from "../socket/socketUtils.js";

const CahContext = createContext(null);

export function CahProvider({ children }) {
  const { user, loading } = useUser();
  const [room, setRoom] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [syncState, setSyncState] = useState("joining");
  const [socketError, setSocketError] = useState(
    !getSocketBase() ? "Set NEXT_PUBLIC_SOCKET_URL (same-origin API mode) or NEXT_PUBLIC_API_URL." : null,
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

      socket = io(`${sockBase}/cah`, {
        path: "/socket.io",
        withCredentials: true,
        auth: { token },
        transports: ["polling", "websocket"],
        autoConnect: true,
        reconnectionAttempts: 10,
        reconnectionDelayMax: 5000,
      });
      if (cancelled) { socket.disconnect(); return; }
      socketRef.current = socket;

      const onRoomPayload = (payload) => {
        if (payload?.room) applyRoomSnapshot(payload.room);
      };

      socket.io.on("reconnect_attempt", async () => {
        dispatchReconcile("cah_reconnect_attempt");
        try {
          const fresh = await fetchAdmissionToken();
          socket.auth = { token: fresh };
        } catch {
          dispatchReconcile("cah_admission_refresh_failed");
        }
      });

      socket.on("connect", () => {
        setConnectionState("connected");
        setSocketError(null);
        setSyncState("syncing");
        void emitAck(socket, "get_room_state", {}).then((result) => {
          if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
          setSyncState("ready");
        });
      });
      socket.on("disconnect", () => {
        setConnectionState("disconnected");
        setSyncState("syncing");
      });
      socket.on("connect_error", async (err) => {
        const msg = err?.message ?? "Could not connect";
        if (msg === "UNAUTHENTICATED" || msg === "SESSION_REVOKED") {
          try {
            await apiFetch("/api/v1/auth/refresh", { method: "POST" });
            const fresh = await fetchAdmissionToken();
            socket.auth = { token: fresh };
            return;
          } catch {
            socket.disconnect();
            setSocketError("Session expired. Please sign in again.");
            setConnectionState("disconnected");
            dispatchReconcile("refresh_failed");
            return;
          }
        }
        setConnectionState("reconnecting");
        setSocketError(msg);
        setSyncState("syncing");
      });
      socket.on("reconnect", () => {
        setConnectionState("connected");
        setSyncState("syncing");
        dispatchReconcile("cah_reconnected");
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
      setSyncState("joining");
      setRoom(null);
      roomVersionRef.current = 0;
    };
  }, [loading, user?.id, applyRoomSnapshot]);

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

  const send = useCallback((event, payload = {}) => emitAck(socketRef.current, event, payload), []);

  const value = useMemo(
    () => ({
      room,
      connected: connectionState === "connected",
      connectionState,
      syncState,
      socketError,
      localUserId: user?.id ?? null,
      localUsername: user?.username ?? "",
      createRoom,
      joinRoom,
      leaveRoom,
      setReady: (ready) => send("set_ready", { ready }),
      updateSettings: (patch) => send("update_settings", patch),
      startGame: () => send("start_game", {}),
      submitCards: (cardIds) => send("submit_cards", { cardIds }),
      judgePickWinner: (submissionId) => send("judge_pick_winner", { submissionId }),
      nextRound: () => send("next_round", {}),
      getRoomState: () => send("get_room_state", {}),
    }),
    [room, connectionState, syncState, socketError, user?.id, user?.username, createRoom, joinRoom, leaveRoom, send],
  );

  return <CahContext.Provider value={value}>{children}</CahContext.Provider>;
}

export function useCah() {
  const ctx = useContext(CahContext);
  if (!ctx) throw new Error("useCah must be used within CahProvider");
  return ctx;
}
