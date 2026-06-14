"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** @typedef {'npat' | 'cah' | 'taboo' | 'hangman' | 'typing-race' | 'generic'} GameContext */

/** @typedef {'retry' | 'sign_in' | 'leave' | 'create_room'} ConnectionActionId */

/** @typedef {'connecting' | 'live' | 'reconnecting' | 'offline' | 'session-ended'} BannerState */

const SESSION_ENDED_CODES = new Set([
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "UNAUTHENTICATED",
  "MISSING_SOCKET_URL",
]);

const BANNER_COPY = {
  connecting: "Joining party…",
  reconnecting: "Back in a sec…",
  reconnecting_extended: "Still trying to reconnect…",
  offline: "Connection lost",
  "session-ended": "Session ended — Sign in again",
  reconnected: "You're back",
};

const RECONNECT_PULSE_MS = 2000;
const EXTENDED_RECONNECT_THRESHOLD_MS = 15_000;

/**
 * @param {{
 *   game?: GameContext,
 *   connected: boolean,
 *   connectionState?: string,
 *   socketLifecycle?: string,
 *   socketError?: string | null,
 *   socketErrorCode?: string | null,
 *   reconnectedAt?: number | null,
 * }} input
 */
export function useConnectionBannerState({
  game: _game,
  connected,
  connectionState,
  socketLifecycle,
  socketError,
  socketErrorCode,
  reconnectedAt,
}) {
  const [tick, setTick] = useState(0);
  const pulseActiveRef = useRef(false);
  const extendedActiveRef = useRef(false);
  const pulseTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const extendedTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    if (!reconnectedAt) return undefined;
    pulseActiveRef.current = true;
    setTick((t) => t + 1);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      pulseActiveRef.current = false;
      setTick((t) => t + 1);
    }, RECONNECT_PULSE_MS);
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [reconnectedAt]);

  const isReconnecting =
    connectionState === "reconnecting" || socketLifecycle === "RECONNECTING";

  useEffect(() => {
    if (isReconnecting && !connected) {
      if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);
      extendedTimerRef.current = setTimeout(() => {
        extendedActiveRef.current = true;
        setTick((t) => t + 1);
      }, EXTENDED_RECONNECT_THRESHOLD_MS);
      return () => {
        if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);
      };
    }
    if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);
    extendedActiveRef.current = false;
    return undefined;
  }, [isReconnecting, connected]);

  const reconnectedPulse = pulseActiveRef.current;
  const extendedReconnect = extendedActiveRef.current;

  return useMemo(() => {
    const isSessionEnded =
      (socketErrorCode && SESSION_ENDED_CODES.has(socketErrorCode)) ||
      /sign in again/i.test(socketError ?? "");

    if (reconnectedPulse && connected && !isSessionEnded) {
      return {
        visible: true,
        state: /** @type {BannerState} */ ("live"),
        message: BANNER_COPY.reconnected,
        showReconnected: true,
        recoverable: false,
        actions: /** @type {ConnectionActionId[]} */ ([]),
      };
    }

    if (isSessionEnded) {
      return {
        visible: true,
        state: /** @type {BannerState} */ ("session-ended"),
        message: BANNER_COPY["session-ended"],
        recoverable: true,
        actions: /** @type {ConnectionActionId[]} */ (["sign_in"]),
        showReconnected: false,
      };
    }

    if (connected && !socketError) {
      return {
        visible: false,
        state: /** @type {BannerState} */ ("live"),
        message: "",
        recoverable: false,
        actions: /** @type {ConnectionActionId[]} */ ([]),
        showReconnected: false,
      };
    }

    if (isReconnecting && !socketError) {
      return {
        visible: true,
        state: /** @type {BannerState} */ ("reconnecting"),
        message: extendedReconnect
          ? BANNER_COPY.reconnecting_extended
          : BANNER_COPY.reconnecting,
        recoverable: true,
        actions: extendedReconnect
          ? /** @type {ConnectionActionId[]} */ (["retry"])
          : /** @type {ConnectionActionId[]} */ ([]),
        showReconnected: false,
      };
    }

    if (!connected && socketError) {
      const roomActions =
        socketErrorCode === "ROOM_NOT_FOUND" || socketErrorCode === "ROOM_EXPIRED"
          ? /** @type {ConnectionActionId[]} */ (["create_room", "leave"])
          : /** @type {ConnectionActionId[]} */ (["retry"]);
      return {
        visible: true,
        state: /** @type {BannerState} */ ("offline"),
        message: socketError || BANNER_COPY.offline,
        recoverable: true,
        actions: roomActions,
        showReconnected: false,
      };
    }

    if (!connected) {
      return {
        visible: true,
        state: /** @type {BannerState} */ ("connecting"),
        message: BANNER_COPY.connecting,
        recoverable: false,
        actions: /** @type {ConnectionActionId[]} */ ([]),
        showReconnected: false,
      };
    }

    return {
      visible: true,
      state: /** @type {BannerState} */ ("offline"),
      message: socketError || BANNER_COPY.offline,
      recoverable: true,
      actions: /** @type {ConnectionActionId[]} */ (["retry"]),
      showReconnected: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connected,
    socketError,
    socketErrorCode,
    reconnectedPulse,
    isReconnecting,
    extendedReconnect,
    tick,
  ]);
}
