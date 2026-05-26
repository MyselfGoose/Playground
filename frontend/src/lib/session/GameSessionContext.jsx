"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/** Matches server disconnect grace — auth recovery should not unmount sockets sooner. */
export const GAME_SESSION_HOLD_MS = 60_000;

const GameSessionContext = createContext(null);

import { setSuppressSocketTeardown } from "./gameSessionTeardown.js";

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function GameSessionProvider({ children }) {
  const [holdActive, setHoldActive] = useState(false);
  const [activeGameId, setActiveGameId] = useState(/** @type {string | null} */ (null));
  const [activeRoomCode, setActiveRoomCode] = useState(/** @type {string | null} */ (null));
  const holdUntilRef = useRef(0);

  const setActiveRoom = useCallback((gameId, code) => {
    if (!gameId || !code) {
      setActiveGameId(null);
      setActiveRoomCode(null);
      return;
    }
    setActiveGameId(gameId);
    setActiveRoomCode(String(code).toUpperCase());
  }, []);

  const beginSessionHold = useCallback(() => {
    holdUntilRef.current = Date.now() + GAME_SESSION_HOLD_MS;
    setSuppressSocketTeardown(true);
    setHoldActive(true);
  }, []);

  const endSessionHold = useCallback(() => {
    holdUntilRef.current = 0;
    setSuppressSocketTeardown(false);
    setHoldActive(false);
  }, []);

  const isWithinSessionHold = useCallback(() => {
    return holdActive && Date.now() < holdUntilRef.current;
  }, [holdActive]);

  const value = useMemo(
    () => ({
      holdActive,
      activeGameId,
      activeRoomCode,
      setActiveRoom,
      beginSessionHold,
      endSessionHold,
      isWithinSessionHold,
    }),
    [
      holdActive,
      activeGameId,
      activeRoomCode,
      setActiveRoom,
      beginSessionHold,
      endSessionHold,
      isWithinSessionHold,
    ],
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
  const ctx = useContext(GameSessionContext);
  if (!ctx) {
    throw new Error("useGameSession must be used within GameSessionProvider");
  }
  return ctx;
}

/** Optional hook for providers outside GameSessionProvider (returns inert defaults). */
export function useGameSessionOptional() {
  return useContext(GameSessionContext);
}
