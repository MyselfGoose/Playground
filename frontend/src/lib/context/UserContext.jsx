"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** @typedef {{ username: string; avatarUrl: string }} MockUser */

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);

  const setUser = useCallback((next) => {
    setUserState(next);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, logout }),
    [user, setUser, logout],
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
