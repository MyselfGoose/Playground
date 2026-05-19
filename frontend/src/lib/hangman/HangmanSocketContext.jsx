"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { connectGameSocket } from "../socket/createGameSocket.js";
import { emitAck } from "../socket/socketUtils.js";
import { SESSION_EXPIRED_MESSAGE } from "../session/sessionInvalidation.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

const HangmanContext = createContext(null);

export function HangmanProvider({ children }) {
  const { user } = useUser();
  const [room, setRoom] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [syncState, setSyncState] = useState("joining");
  const [socketError, setSocketError] = useState(
    !getSocketBase() ? connectionMessage("hangman", "missing_socket_url") : null,
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    !getSocketBase() ? "MISSING_SOCKET_URL" : null,
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));
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

  const resyncRoom = useCallback(
    (socket) => {
      setSyncState("syncing");
      void emitAck(socket, "get_room_state", {}).then((result) => {
        if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
        setSyncState("ready");
      });
    },
    [applyRoomSnapshot],
  );

  useEffect(() => {
    if (!user?.id || !getSocketBase()) return undefined;

    let cancelled = false;
    /** @type {(() => void) | null} */
    let cleanup = null;

    try {
      const { socket, cleanup: socketCleanup } = connectGameSocket({
        namespace: "/hangman",
        gameTag: "hangman",
        onConnect: (s) => {
          if (cancelled) return;
          setConnectionState("connected");
          setSocketError(null);
          setSocketErrorCode(null);
          resyncRoom(s);
        },
        onDisconnect: () => {
          if (cancelled) return;
          setConnectionState("reconnecting");
          setSyncState("syncing");
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          const mapped = mapConnectionError("hangman", msg);
          setConnectionState("reconnecting");
          setSocketError(mapped.message);
          setSocketErrorCode(mapped.code);
          setSyncState("syncing");
        },
        onReconnect: (s) => {
          if (cancelled) return;
          setConnectionState("connected");
          setReconnectedAt(Date.now());
          resyncRoom(s);
        },
        onReconnectFailed: () => {
          if (cancelled) return;
          setSocketError(SESSION_EXPIRED_MESSAGE);
          setSocketErrorCode("SESSION_EXPIRED");
          setConnectionState("disconnected");
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
        if (payload?.room) applyRoomSnapshot(payload.room);
      };
      socket.on("room_update", onRoomPayload);
      socket.on("session_resumed", onRoomPayload);
    } catch {
      if (!cancelled) {
        setSocketError(connectionMessage("hangman", "missing_socket_url"));
        setSocketErrorCode("MISSING_SOCKET_URL");
      }
      return undefined;
    }

    return () => {
      cancelled = true;
      cleanup?.();
      socketRef.current = null;
      setConnectionState("disconnected");
      setReconnectedAt(null);
      setSyncState("joining");
      setRoom(null);
      roomVersionRef.current = 0;
      roomCodeRef.current = null;
    };
  }, [user?.id, applyRoomSnapshot, resyncRoom]);

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
      roomCodeRef.current = null;
    }
    return result;
  }, []);

  const send = useCallback((event, payload = {}) => emitAck(socketRef.current, event, payload), []);

  const retryConnection = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const value = useMemo(
    () => ({
      room,
      connected: connectionState === "connected",
      connectionState,
      syncState,
      socketError,
      socketErrorCode,
      reconnectedAt,
      localUserId: user?.id ?? null,
      localUsername: user?.username ?? "",
      createRoom,
      joinRoom,
      leaveRoom,
      applyRoomSnapshot,
      send,
      setReady: (ready) => send("set_ready", { ready }),
      startGame: () => send("start_game", {}),
      guessLetter: (letter) => send("guess_letter", { letter }),
      getRoomState: () => send("get_room_state", {}),
      retryConnection,
    }),
    [
      room,
      connectionState,
      syncState,
      socketError,
      socketErrorCode,
      reconnectedAt,
      retryConnection,
      user?.id,
      user?.username,
      createRoom,
      joinRoom,
      leaveRoom,
      applyRoomSnapshot,
      send,
    ],
  );

  return <HangmanContext.Provider value={value}>{children}</HangmanContext.Provider>;
}

export function useHangman() {
  const ctx = useContext(HangmanContext);
  if (!ctx) throw new Error("useHangman must be used within HangmanProvider");
  return ctx;
}
