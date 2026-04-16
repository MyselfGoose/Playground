"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, apiFetch } from "../api.js";

/** @typedef {{ id: string; username: string; email: string; roles: string[]; avatarUrl: string }} AuthUser */

const UserContext = createContext(null);

function avatarUrlFor(username) {
  const seed = encodeURIComponent(username || "player");
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`;
}

/** @param {Record<string, unknown> | null | undefined} u */
function mapUser(u) {
  if (!u) return null;
  const id = u._id != null ? String(u._id) : u.id != null ? String(u.id) : "";
  const username = typeof u.username === "string" ? u.username : "";
  return {
    id,
    username,
    email: typeof u.email === "string" ? u.email : "",
    roles: Array.isArray(u.roles) ? u.roles.map(String) : [],
    avatarUrl: avatarUrlFor(username),
  };
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(/** @type {AuthUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();

    async function bootstrap() {
      setLoading(true);
      try {
        const me = await apiFetch("/api/v1/auth/me", { signal: ac.signal });
        if (!mountedRef.current || ac.signal.aborted) return;
        setUserState(mapUser(me?.data?.user));
      } catch (e) {
        if (e?.name === "AbortError" || ac.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) {
          try {
            await apiFetch("/api/v1/auth/refresh", { method: "POST", signal: ac.signal });
            const me = await apiFetch("/api/v1/auth/me", { signal: ac.signal });
            if (!mountedRef.current || ac.signal.aborted) return;
            setUserState(mapUser(me?.data?.user));
          } catch {
            if (!mountedRef.current || ac.signal.aborted) return;
            setUserState(null);
          }
        } else {
          if (!mountedRef.current || ac.signal.aborted) return;
          setUserState(null);
        }
      } finally {
        if (mountedRef.current && !ac.signal.aborted) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      mountedRef.current = false;
      ac.abort();
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch("/api/v1/auth/me");
      const next = mapUser(me?.data?.user);
      setUserState(next);
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        try {
          await apiFetch("/api/v1/auth/refresh", { method: "POST" });
          const me = await apiFetch("/api/v1/auth/me");
          const next = mapUser(me?.data?.user);
          setUserState(next);
          return next;
        } catch {
          setUserState(null);
          return null;
        }
      }
      setUserState(null);
      return null;
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const json = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const next = mapUser(json?.data?.user);
    setUserState(next);
    return next;
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    const json = await apiFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    const next = mapUser(json?.data?.user);
    setUserState(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Still drop client state; server clears cookies when reachable.
    }
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}

/** Alias for the same auth context (user + loading + login/register/logout). */
export function useAuth() {
  return useUser();
}
