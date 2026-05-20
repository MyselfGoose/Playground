"use client";

import { createContext, useContext } from "react";
import { useGameSocket } from "./useGameSocket.js";

/** @type {import('react').Context<ReturnType<typeof useGameSocket> | null>} */
const GameSocketContext = createContext(null);

/**
 * Generic provider wrapping useGameSocket. Prefer per-game contexts that call useGameSocket
 * directly unless you need a standalone namespace-only provider.
 *
 * @param {import('./useGameSocket.js').UseGameSocketOptions & { children: import('react').ReactNode }} props
 */
export function GameSocketProvider({ children, ...socketOptions }) {
  const value = useGameSocket(socketOptions);
  return <GameSocketContext.Provider value={value}>{children}</GameSocketContext.Provider>;
}

export function useGameSocketContext() {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error("useGameSocketContext must be used within GameSocketProvider");
  return ctx;
}
