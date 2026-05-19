"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { connectGameSocket } from "../socket/createGameSocket.js";
import { emitAck } from "../socket/socketUtils.js";
import { SESSION_EXPIRED_MESSAGE } from "../session/sessionInvalidation.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

const TabooContext = createContext(null);

export function TabooProvider({ children }) {
  const { user, loading } = useUser();
  const [room, setRoom] = useState(null);
  const [categories, setCategories] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [socketError, setSocketError] = useState(
    !getSocketBase() ? connectionMessage("taboo", "missing_socket_url") : null,
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    !getSocketBase() ? "MISSING_SOCKET_URL" : null,
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const socketRef = useRef(/** @type {import("socket.io-client").Socket | null} */ (null));
  const roomVersionRef = useRef(0);

  const applyRoomSnapshot = useCallback((incomingRoom) => {
    if (!incomingRoom || typeof incomingRoom !== "object") return;
    const sn = /** @type {{ serverNow?: number }} */ (incomingRoom).serverNow;
    if (typeof sn === "number") {
      setServerOffsetMs(sn - Date.now());
    }
    const nextVersion = Number(incomingRoom.stateVersion || 0);
    const prevVersion = Number(roomVersionRef.current || 0);
    if (nextVersion < prevVersion) return;
    roomVersionRef.current = nextVersion;
    setRoom(incomingRoom);
  }, []);

  const serverNow = useCallback(() => Date.now() + serverOffsetMs, [serverOffsetMs]);

  const resyncRoom = useCallback(
    (socket) => {
      void emitAck(socket, "get_room_state", {}).then((result) => {
        if (result.ok && result.data?.room) applyRoomSnapshot(result.data.room);
      });
    },
    [applyRoomSnapshot],
  );

  useEffect(() => {
    if (loading || !user || !getSocketBase()) return undefined;

    let cancelled = false;
    /** @type {(() => void) | null} */
    let cleanup = null;

    try {
      const { socket, cleanup: socketCleanup } = connectGameSocket({
        namespace: "/taboo",
        gameTag: "taboo",
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
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          const mapped = mapConnectionError("taboo", msg);
          setConnectionState("reconnecting");
          setSocketError(mapped.message);
          setSocketErrorCode(mapped.code);
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
        setSocketError(connectionMessage("taboo", "missing_socket_url"));
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
      setRoom(null);
      roomVersionRef.current = 0;
      setServerOffsetMs(0);
      setCategories([]);
    };
  }, [loading, user?.id, applyRoomSnapshot, resyncRoom]);

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

  const retryConnection = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const value = useMemo(() => ({
    room,
    connected: connectionState === "connected",
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    serverOffsetMs,
    serverNow,
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
    /** TD-18: Game starts via setReady → maybeStartIfReady; host start_game is unused by UI. */
    startGame: () => send("start_game", {}),
    startTurn: () => send("start_turn", {}),
    holdTurnStart: () => send("hold_turn_start", {}),
    submitGuess: (guess) => send("submit_guess", { guess }),
    skipCard: () => send("skip_card", {}),
    tabooCalled: () => send("taboo_called", {}),
    requestReview: () => send("request_review", {}),
    dismissReview: () => send("dismiss_review", {}),
    reviewVote: (vote) => send("review_vote", { vote }),
    reviewContinue: () => send("review_continue", {}),
    retryConnection,
  }), [room, connectionState, socketError, socketErrorCode, reconnectedAt, serverOffsetMs, serverNow, retryConnection, user?.id, user?.username, categories, createRoom, joinRoom, leaveRoom, getCategories, send]);

  return <TabooContext.Provider value={value}>{children}</TabooContext.Provider>;
}

export function useTaboo() {
  const ctx = useContext(TabooContext);
  if (!ctx) throw new Error("useTaboo must be used within TabooProvider");
  return ctx;
}
