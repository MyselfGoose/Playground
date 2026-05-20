"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocketBase } from "../api.js";
import { connectGameSocket } from "./createGameSocket.js";
import { emitAck } from "./socketUtils.js";
import { SESSION_EXPIRED_MESSAGE } from "../session/sessionInvalidation.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

/**
 * @typedef {'disconnected' | 'reconnecting' | 'connected'} ConnectionState
 * @typedef {'joining' | 'syncing' | 'ready'} SyncState
 */

/**
 * Default stateVersion merge (monotonic); games with extra rules pass custom mergeRoom.
 *
 * @param {Record<string, unknown> | null} incoming
 * @param {{ setRoom: (r: Record<string, unknown> | null) => void, roomVersionRef: React.MutableRefObject<number> }} ctx
 */
export function mergeRoomByStateVersion(incoming, { setRoom, roomVersionRef }) {
  if (!incoming || typeof incoming !== "object") return;
  const nextVersion = Number(incoming.stateVersion || 0);
  const prevVersion = Number(roomVersionRef.current || 0);
  if (nextVersion < prevVersion) return;
  roomVersionRef.current = nextVersion;
  setRoom(incoming);
}

/** @typedef {import('./types.js').RoomSnapshotBase} RoomSnapshotBase */

/**
 * @typedef {Object} UseGameSocketOptions
 * @property {string} namespace e.g. `/hangman`
 * @property {string} gameTag reconcile prefix for createGameSocket
 * @property {string} mapGame mapConnectionError game id
 * @property {boolean} [enabled] when false, socket effect is skipped
 * @property {boolean} [trackSyncState] expose joining/syncing/ready lifecycle
 * @property {(incoming: Record<string, unknown> | null, ctx: {
 *   setRoom: (r: Record<string, unknown> | null) => void,
 *   roomVersionRef: React.MutableRefObject<number>,
 *   roomCodeRef: React.MutableRefObject<string | null>,
 * }) => void} mergeRoom
 * @property {(socket: import('socket.io-client').Socket) => void} [resync] visibility/connect resync
 * @property {Record<string, (payload: unknown) => void>} [serverEvents] extra socket.on handlers
 * @property {(payload: unknown) => boolean} [shouldAcceptSessionResumed] filter session_resumed
 * @property {string} [resyncEvent] ack event for default resync (default `get_room_state`)
 * @property {(payload: { room?: Record<string, unknown>, reason?: string }) => void} [onRoomUpdate] called before merge on room_update / session_resumed
 * @property {() => void} [onReconnectFailedExtra] after default reconnect-failed handling
 * @property {(payload: { room?: Record<string, unknown> }) => void} [onSessionResumedExtra] after session_resumed accepted
 */

/**
 * Shared socket connection, room merge, emitAck, and reconnect handling for multiplayer games.
 *
 * @param {UseGameSocketOptions} options
 */
export function useGameSocket({
  namespace,
  gameTag,
  mapGame,
  enabled = true,
  trackSyncState = false,
  mergeRoom,
  resync: resyncOverride,
  serverEvents = {},
  shouldAcceptSessionResumed,
  resyncEvent = "get_room_state",
  onRoomUpdate,
  onReconnectFailedExtra,
  onSessionResumedExtra,
}) {
  const [room, setRoom] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [connectionState, setConnectionState] = useState(
    /** @type {ConnectionState} */ ("disconnected"),
  );
  const [syncState, setSyncState] = useState(/** @type {SyncState} */ ("joining"));
  const [socketError, setSocketError] = useState(
    /** @type {string | null} */ (
      !getSocketBase() ? connectionMessage(mapGame, "missing_socket_url") : null
    ),
  );
  const [socketErrorCode, setSocketErrorCode] = useState(
    /** @type {string | null} */ (!getSocketBase() ? "MISSING_SOCKET_URL" : null),
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));

  const socketRef = useRef(/** @type {import("socket.io-client").Socket | null} */ (null));
  const roomVersionRef = useRef(0);
  const roomCodeRef = useRef(/** @type {string | null} */ (null));

  const mergeCtx = useMemo(
    () => ({ setRoom, roomVersionRef, roomCodeRef }),
    [],
  );

  const applyRoom = useCallback(
    (incoming) => {
      mergeRoom(incoming, mergeCtx);
    },
    [mergeRoom, mergeCtx],
  );

  const defaultResync = useCallback(
    (socket) => {
      if (trackSyncState) setSyncState("syncing");
      void emitAck(socket, resyncEvent, {}).then((result) => {
        if (result.ok && result.data?.room) {
          applyRoom(/** @type {Record<string, unknown>} */ (result.data.room));
        }
        if (trackSyncState) setSyncState("ready");
      });
    },
    [applyRoom, trackSyncState, resyncEvent],
  );

  const resyncRoom = resyncOverride ?? defaultResync;

  useEffect(() => {
    if (!enabled || !getSocketBase()) return undefined;

    let cancelled = false;
    /** @type {(() => void) | null} */
    let cleanup = null;

    const onRoomPayload = (payload) => {
      const p = /** @type {{ room?: Record<string, unknown>, reason?: string }} */ (payload);
      onRoomUpdate?.(p);
      if (p?.room) applyRoom(p.room);
    };

    try {
      const { socket, cleanup: socketCleanup } = connectGameSocket({
        namespace,
        gameTag,
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
          if (trackSyncState) setSyncState("syncing");
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          const mapped = mapConnectionError(mapGame, msg);
          setConnectionState("reconnecting");
          setSocketError(mapped.message);
          setSocketErrorCode(mapped.code);
          if (trackSyncState) setSyncState("syncing");
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
          onReconnectFailedExtra?.();
        },
        onVisibilityResync: resyncRoom,
      });

      if (cancelled) {
        socketCleanup();
        return undefined;
      }

      socketRef.current = socket;
      cleanup = socketCleanup;

      const onSessionResumed = (payload) => {
        if (shouldAcceptSessionResumed && !shouldAcceptSessionResumed(payload)) return;
        const p = /** @type {{ room?: Record<string, unknown> }} */ (payload);
        onSessionResumedExtra?.(p);
        onRoomPayload(payload);
      };

      socket.on("room_update", onRoomPayload);
      socket.on("session_resumed", onSessionResumed);

      const eventEntries = Object.entries(serverEvents);
      for (const [event, handler] of eventEntries) {
        socket.on(event, handler);
      }

      const prevCleanup = cleanup;
      cleanup = () => {
        socket.off("room_update", onRoomPayload);
        socket.off("session_resumed", onSessionResumed);
        for (const [event, handler] of eventEntries) {
          socket.off(event, handler);
        }
        prevCleanup?.();
      };
    } catch {
      if (!cancelled) {
        setSocketError(connectionMessage(mapGame, "missing_socket_url"));
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
      if (trackSyncState) setSyncState("joining");
      setRoom(null);
      roomVersionRef.current = 0;
      roomCodeRef.current = null;
    };
  }, [
    enabled,
    namespace,
    gameTag,
    mapGame,
    applyRoom,
    resyncRoom,
    trackSyncState,
    serverEvents,
    shouldAcceptSessionResumed,
    onRoomUpdate,
    onReconnectFailedExtra,
    onSessionResumedExtra,
  ]);

  const send = useCallback(
    (event, payload = {}) => emitAck(socketRef.current, event, payload),
    [],
  );

  const createRoom = useCallback(
    async (settings) => {
      const result = await emitAck(socketRef.current, "create_room", settings ?? {});
      if (result.ok && result.data?.room) {
        applyRoom(/** @type {Record<string, unknown>} */ (result.data.room));
      }
      return result;
    },
    [applyRoom],
  );

  const joinRoom = useCallback(
    async (code) => {
      const normalized = String(code ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
      const result = await emitAck(socketRef.current, "join_room", { code: normalized });
      if (result.ok && result.data?.room) {
        applyRoom(/** @type {Record<string, unknown>} */ (result.data.room));
      }
      return result;
    },
    [applyRoom],
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

  const retryConnection = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  const resetRoomState = useCallback(() => {
    setRoom(null);
    roomVersionRef.current = 0;
    roomCodeRef.current = null;
  }, []);

  return {
    room,
    setRoom,
    applyRoom,
    connectionState,
    connected: connectionState === "connected",
    syncState,
    socketError,
    socketErrorCode,
    setSocketError,
    setSocketErrorCode,
    reconnectedAt,
    socketRef,
    send,
    createRoom,
    joinRoom,
    leaveRoom,
    retryConnection,
    resetRoomState,
    roomVersionRef,
    roomCodeRef,
  };
}
