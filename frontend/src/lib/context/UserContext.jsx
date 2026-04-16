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
  const [sessionError, setSessionError] = useState(/** @type {string | null} */ (null));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();

    async function bootstrap() {
      setLoading(true);
      setSessionError(null);
      try {
        const me = await apiFetch("/api/v1/auth/me", { signal: ac.signal });
        if (!mountedRef.current || ac.signal.aborted) return;
        setUserState(mapUser(me?.data?.user));
      } catch (e) {
        if (e?.name === "AbortError" || ac.signal.aborted) return;
        if (!mountedRef.current) return;
        if (e instanceof ApiError && e.status === 401) {
          // apiFetch already tried /refresh. A 401 here means no valid session.
          setUserState(null);
        } else if (e instanceof ApiError && e.status >= 500) {
          // Server error — keep whatever we have (nothing on bootstrap) and surface the error.
          setSessionError(e.message);
        } else {
          // Network / CORS / parse error — surface but don't flip to logged-out.
          setSessionError(e?.message ?? "Could not reach the server");
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
      setSessionError(null);
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUserState(null);
        return null;
      }
      setSessionError(e instanceof Error ? e.message : "Could not reach the server");
      return user;
    }
  }, [user]);

  const login = useCallback(async ({ email, password }) => {
    const json = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: typeof email === "string" ? email.trim().toLowerCase() : email,
        password,
      }),
    });
    const next = mapUser(json?.data?.user);
    setUserState(next);
    setSessionError(null);
    return next;
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    const json = await apiFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: typeof username === "string" ? username.trim() : username,
        email: typeof email === "string" ? email.trim().toLowerCase() : email,
        password,
      }),
    });
    const next = mapUser(json?.data?.user);
    setUserState(next);
    setSessionError(null);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Still drop client state; server clears cookies when reachable.
    }
    setUserState(null);
    setSessionError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, sessionError, login, register, logout, refreshUser],
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
