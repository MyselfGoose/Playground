"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocketBase } from "../api.js";
import { connectGameSocket } from "./createGameSocket.js";
import { emitAck, ACK_TIMEOUT_MS } from "./socketUtils.js";
import { connectionMessage, mapConnectionError } from "../errors/mapConnectionError.js";

/**
 * @typedef {'disconnected' | 'connecting' | 'reconnecting' | 'connected'} ConnectionState
 * @typedef {'idle' | 'joining' | 'syncing' | 'ready' | 'error'} SyncState
 */

/**
 * @param {boolean} trackSyncState
 * @param {boolean} enabled
 * @returns {SyncState}
 */
function initialSyncState(trackSyncState, enabled) {
  if (!trackSyncState) return "ready";
  return enabled ? "joining" : "ready";
}

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
 * @property {boolean} [trackSyncState] expose idle/joining/syncing/ready lifecycle
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
  onRoomUpdate,
  onReconnectFailedExtra,
  onSessionResumedExtra,
  resyncEvent = "get_room_state",
}) {
  const [room, setRoom] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [connectionState, setConnectionState] = useState(
    /** @type {ConnectionState} */ ("disconnected"),
  );
  const [syncState, setSyncState] = useState(
    /** @type {SyncState} */ (initialSyncState(trackSyncState, enabled)),
  );
  const [socketError, setSocketErrorState] = useState(
    /** @type {string | null} */ (
      !getSocketBase() ? connectionMessage(mapGame, "missing_socket_url") : null
    ),
  );
  const [socketErrorCode, setSocketErrorCodeState] = useState(
    /** @type {string | null} */ (!getSocketBase() ? "MISSING_SOCKET_URL" : null),
  );
  const [reconnectedAt, setReconnectedAt] = useState(/** @type {number | null} */ (null));

  const socketRef = useRef(/** @type {import("socket.io-client").Socket | null} */ (null));
  const roomVersionRef = useRef(0);
  const roomCodeRef = useRef(/** @type {string | null} */ (null));
  const hasConnectedOnceRef = useRef(false);

  const onRoomUpdateRef = useRef(onRoomUpdate);
  const onReconnectFailedExtraRef = useRef(onReconnectFailedExtra);
  const onSessionResumedExtraRef = useRef(onSessionResumedExtra);
  const shouldAcceptSessionResumedRef = useRef(shouldAcceptSessionResumed);
  const serverEventsRef = useRef(serverEvents);

  onRoomUpdateRef.current = onRoomUpdate;
  onReconnectFailedExtraRef.current = onReconnectFailedExtra;
  onSessionResumedExtraRef.current = onSessionResumedExtra;
  shouldAcceptSessionResumedRef.current = shouldAcceptSessionResumed;
  serverEventsRef.current = serverEvents;

  const mergeCtx = useMemo(
    () => ({ setRoom, roomVersionRef, roomCodeRef }),
    [],
  );

  const applyRoom = useCallback(
    (incoming) => {
      mergeRoom(incoming, mergeCtx);
      if (
        trackSyncState &&
        incoming &&
        typeof incoming === "object" &&
        typeof incoming.code === "string" &&
        incoming.code.trim()
      ) {
        setSyncState("ready");
      }
    },
    [mergeRoom, mergeCtx, trackSyncState],
  );

  const setSocketError = useCallback((message, code) => {
    setSocketErrorState(message);
    setSocketErrorCodeState(code ?? null);
  }, []);

  const defaultResync = useCallback(
    (socket) => {
      if (trackSyncState) setSyncState("syncing");
      const syncTimeout = setTimeout(() => {
        if (trackSyncState) setSyncState("error");
      }, ACK_TIMEOUT_MS);
      void emitAck(socket, resyncEvent, {})
        .then((result) => {
          if (result.ok && result.data?.room) {
            applyRoom(/** @type {Record<string, unknown>} */ (result.data.room));
            if (trackSyncState) setSyncState("ready");
          } else if (result.ok) {
            if (trackSyncState) setSyncState("ready");
          } else if (trackSyncState) {
            const errCode = /** @type {{ code?: string }} */ (result.error)?.code;
            if (errCode === "NOT_IN_ROOM") {
              setSyncState("ready");
            } else {
              setSyncState("error");
            }
          }
        })
        .finally(() => {
          clearTimeout(syncTimeout);
        });
    },
    [applyRoom, trackSyncState, resyncEvent],
  );

  const resyncRoom = resyncOverride ?? defaultResync;

  useEffect(() => {
    if (!trackSyncState) return;
    if (!enabled) {
      setSyncState("ready");
    }
  }, [enabled, trackSyncState]);

  useEffect(() => {
    if (!enabled || !getSocketBase()) {
      return undefined;
    }

    let cancelled = false;
    /** @type {(() => void) | null} */
    let cleanup = null;

    const onRoomPayload = (payload) => {
      const p = /** @type {{ room?: Record<string, unknown>, reason?: string }} */ (payload);
      onRoomUpdateRef.current?.(p);
      if (p?.room) applyRoom(p.room);
    };

    try {
      if (trackSyncState) setSyncState("joining");
      setConnectionState("connecting");

      const { socket, cleanup: socketCleanup } = connectGameSocket({
        namespace,
        gameTag,
        onConnect: (s) => {
          if (cancelled) return;
          hasConnectedOnceRef.current = true;
          setConnectionState("connected");
          setSocketError(null, null);
          resyncRoom(s);
        },
        onDisconnect: () => {
          if (cancelled) return;
          setConnectionState(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
          if (trackSyncState) setSyncState("syncing");
        },
        onConnectError: (_s, msg) => {
          if (cancelled) return;
          const mapped = mapConnectionError(mapGame, msg);
          setConnectionState(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
          setSocketError(mapped.message, mapped.code);
          if (trackSyncState) setSyncState("error");
        },
        onReconnect: (s) => {
          if (cancelled) return;
          hasConnectedOnceRef.current = true;
          setConnectionState("connected");
          setReconnectedAt(Date.now());
          resyncRoom(s);
        },
        onReconnectFailed: () => {
          if (cancelled) return;
          setSocketError(
            connectionMessage(mapGame, "connection_lost"),
            "CONNECTION_LOST",
          );
          setConnectionState("disconnected");
          onReconnectFailedExtraRef.current?.();
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
        const accept = shouldAcceptSessionResumedRef.current;
        if (accept && !accept(payload)) return;
        const p = /** @type {{ room?: Record<string, unknown> }} */ (payload);
        onSessionResumedExtraRef.current?.(p);
        onRoomPayload(payload);
        if (trackSyncState) setSyncState("ready");
      };

      socket.on("room_update", onRoomPayload);
      socket.on("session_resumed", onSessionResumed);

      const events = serverEventsRef.current;
      for (const [event, handler] of Object.entries(events)) {
        socket.on(event, handler);
      }

      const prevCleanup = cleanup;
      cleanup = () => {
        socket.off("room_update", onRoomPayload);
        socket.off("session_resumed", onSessionResumed);
        for (const [event, handler] of Object.entries(events)) {
          socket.off(event, handler);
        }
        prevCleanup?.();
      };
    } catch {
      if (!cancelled) {
        setSocketError(connectionMessage(mapGame, "missing_socket_url"), "MISSING_SOCKET_URL");
        if (trackSyncState) setSyncState("error");
      }
      return undefined;
    }

    return () => {
      cancelled = true;
      cleanup?.();
      socketRef.current = null;
      hasConnectedOnceRef.current = false;
      setConnectionState("disconnected");
      setReconnectedAt(null);
      if (trackSyncState) setSyncState("ready");
      setRoom(null);
      roomVersionRef.current = 0;
      roomCodeRef.current = null;
    };
  }, [enabled, namespace, gameTag, mapGame, applyRoom, resyncRoom, trackSyncState, setSocketError]);

  const send = useCallback(
    (event, payload = {}) => emitAck(socketRef.current, event, payload),
    [],
  );

  const createRoom = useCallback(
    async (settings) => {
      const result = await emitAck(socketRef.current, "create_room", settings ?? {});
      if (result.ok && result.data?.room) {
        applyRoom(/** @type {Record<string, unknown>} */ (result.data.room));
        if (trackSyncState) setSyncState("ready");
      }
      return result;
    },
    [applyRoom, trackSyncState],
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
        if (trackSyncState) setSyncState("ready");
      }
      return result;
    },
    [applyRoom, trackSyncState],
  );

  const leaveRoom = useCallback(async () => {
    const result = await emitAck(socketRef.current, "leave_room", {});
    setRoom(null);
    roomVersionRef.current = 0;
    roomCodeRef.current = null;
    if (trackSyncState) setSyncState("ready");
    return result;
  }, [trackSyncState]);

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
    setSocketErrorCode: setSocketErrorCodeState,
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
