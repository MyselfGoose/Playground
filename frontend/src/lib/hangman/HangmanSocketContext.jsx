"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getSocketBase, apiFetch, ApiError } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { emitAck, fetchAdmissionToken as fetchAdmission } from "../socket/socketUtils.js";
import { recoverSocketAuthAfterHandshakeFailure } from "../socket/recoverSocketAuth.js";

const HangmanContext = createContext(null);

export function HangmanProvider({ children }) {
  const { user } = useUser();
  const [room, setRoom] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [syncState, setSyncState] = useState("joining");
  const [socketError, setSocketError] = useState(
    !getSocketBase() ? "Set NEXT_PUBLIC_SOCKET_URL or NEXT_PUBLIC_API_URL." : null,
  );
  const socketRef = useRef(/** @type {import("socket.io-client").Socket | null} */ (null));
  const roomVersionRef = useRef(0);
  const roomCodeRef = useRef(null);

  const applyRoomSnapshot = useCallback((incomingRoom) => {
    if (!incomingRoom || typeof incomingRoom !== "object") return;
    const incomingCode = typeof incomingRoom.code === "string" ? incomingRoom.code : null;
    const previousCode = roomCodeRef.current;
    const nextVersion = Number(incomingRoom.stateVersion || 0);
    const prevVersion = Number(roomVersionRef.current || 0);
    if (previousCode && incomingCode && previousCode !== incomingCode) {
      roomVersionRef.current = 0;
    }
    if (incomingCode !== previousCode) {
      roomCodeRef.current = incomingCode;
    }
    if (nextVersion < roomVersionRef.current) return;
    roomVersionRef.current = nextVersion;
    setRoom(incomingRoom);
  }, []);

  useEffect(() => {
    const sockBase = getSocketBase();
    if (!user?.id || !sockBase) return undefined;

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

      socket = io(`${sockBase}/hangman`, {
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
        dispatchReconcile("hangman_reconnect_attempt");
        try {
          const fresh = await fetchAdmissionToken();
          socket.auth = { token: fresh };
        } catch {
          dispatchReconcile("hangman_admission_refresh_failed");
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
            await recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, fetchAdmissionToken);
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
        dispatchReconcile("hangman_reconnected");
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
      roomCodeRef.current = null;
    };
  }, [user?.id, applyRoomSnapshot]);

  const createRoom = useCallback(
    async (settings) => {
      const result = await emitAck(socketRef.current, "create_room", settings ?? {});
      if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
      return result;
    },
    [applyRoomSnapshot],
  );

  const joinRoom = useCallback(
    async (code) => {
      const normalized = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const result = await emitAck(socketRef.current, "join_room", { code: normalized });
      if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
      return result;
    },
    [applyRoomSnapshot],
  );

  const leaveRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "leave_room", {});
    if (result.ok) {
      setRoom(null);
      roomVersionRef.current = 0;
      roomCodeRef.current = null;
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
      send,
      applyRoomSnapshot,
    }),
    [room, connectionState, syncState, socketError, user?.id, user?.username, createRoom, joinRoom, leaveRoom, send, applyRoomSnapshot],
  );

  return <HangmanContext.Provider value={value}>{children}</HangmanContext.Provider>;
}

export function useHangman() {
  const ctx = useContext(HangmanContext);
  if (!ctx) throw new Error("useHangman must be used within HangmanProvider");
  return ctx;
}
