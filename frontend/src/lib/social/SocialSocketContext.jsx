"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { connectGameSocket } from "../socket/createGameSocket.js";

/** @typedef {(payload: unknown) => void} SocialEventHandler */

const SocialSocketContext = createContext(null);

export function SocialSocketProvider({ children }) {
  const { user, loading } = useUser();
  /** @type {import('react').MutableRefObject<Map<string, Set<SocialEventHandler>>>} */
  const subscribersRef = useRef(new Map());
  const cleanupRef = useRef(/** @type {(() => void) | null} */ (null));

  const subscribe = useCallback((event, handler) => {
    const key = String(event);
    const map = subscribersRef.current;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(handler);
    return () => {
      map.get(key)?.delete(handler);
    };
  }, []);

  const dispatch = useCallback((event, payload) => {
    const handlers = subscribersRef.current.get(String(event));
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        /* subscriber error */
      }
    }
  }, []);

  useEffect(() => {
    if (loading || !user?.id || !getSocketBase()) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      return undefined;
    }

    let cancelled = false;

    const { socket, cleanup } = connectGameSocket({
      namespace: "/social",
      gameTag: "social",
      onConnect: () => {
        if (!cancelled) dispatch("social_connected", {});
      },
      onReconnect: () => {
        if (!cancelled) dispatch("social_reconnected", {});
      },
    });

    const events = [
      "presence_snapshot",
      "friend_online",
      "friend_offline",
      "friend_request_received",
      "friend_request_accepted",
      "friend_request_declined",
      "friend_request_cancelled",
      "friend_removed",
      "game_invite_received",
      "game_invite_cancelled",
      "game_invite_resolved",
      "profile:updated",
    ];

    for (const event of events) {
      socket.on(event, (payload) => dispatch(event, payload));
    }

    cleanupRef.current = () => {
      for (const event of events) {
        socket.off(event);
      }
      cleanup();
    };

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [loading, user?.id, dispatch]);

  const value = useMemo(
    () => ({
      subscribe,
      enabled: Boolean(user?.id),
    }),
    [subscribe, user?.id],
  );

  return <SocialSocketContext.Provider value={value}>{children}</SocialSocketContext.Provider>;
}

export function useSocialSocket() {
  const ctx = useContext(SocialSocketContext);
  if (!ctx) throw new Error("useSocialSocket must be used within SocialSocketProvider");
  return ctx;
}
