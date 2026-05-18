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
import { usePathname } from "next/navigation";
import { ApiError, apiFetch } from "../api.js";
import { invalidateDerivedCaches } from "../reconciliation/leaderboardInvalidation.js";
import { notifyRefreshCompleted, subscribeReconcile } from "../reconciliation/reconciliationEvents.js";
import { subscribeSessionInvalidated } from "../session/sessionInvalidation.js";

/** @typedef {{ id: string; username: string; email: string; roles: string[]; avatarUrl: string }} AuthUser */

/** @typedef {'INIT'|'HYDRATING'|'SYNCED'|'DEGRADED'|'RECOVERING'} SessionLifecycle */

const UserContext = createContext(null);

const RECONCILE_DEBOUNCE_MS = 500;
/** Only surface RECOVERING UI if reconcile exceeds this (routine nav reconcile stays invisible). */
const RECOVERING_UI_DELAY_MS = 800;

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

async function fetchMeWithRetries(signal, maxAttempts = 4) {
  let delay = 400;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await apiFetch("/api/v1/auth/me", { signal });
    } catch (e) {
      if (signal?.aborted || e?.name === "AbortError") throw e;
      if (e instanceof ApiError && e.status === 401) throw e;
      if (attempt >= maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 4000);
    }
  }
  throw new Error("bootstrap exhausted");
}

export function UserProvider({ children }) {
  const pathname = usePathname();
  const [user, setUserState] = useState(/** @type {AuthUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(/** @type {string | null} */ (null));
  /** One-shot copy when an authenticated session ends — not shown to guests. */
  const [sessionNotice, setSessionNotice] = useState(/** @type {string | null} */ (null));
  const [lifecycle, setLifecycle] = useState(/** @type {SessionLifecycle} */ ("INIT"));

  const mountedRef = useRef(true);
  const reconcileTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  /** Skip navigation-driven reconcile briefly after login/register so Set-Cookie can settle before `/me`. */
  const skipNavigationReconcileUntilRef = useRef(0);
  const lifecycleRef = useRef(lifecycle);
  const sessionErrorRef = useRef(sessionError);
  const sessionNoticeRef = useRef(sessionNotice);
  const userRef = useRef(user);
  const reconcileInFlightRef = useRef(false);
  const recoveringUiTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    lifecycleRef.current = lifecycle;
  }, [lifecycle]);
  useEffect(() => {
    sessionErrorRef.current = sessionError;
  }, [sessionError]);
  useEffect(() => {
    sessionNoticeRef.current = sessionNotice;
  }, [sessionNotice]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearRecoveringUiTimer = useCallback(() => {
    if (recoveringUiTimerRef.current) {
      clearTimeout(recoveringUiTimerRef.current);
      recoveringUiTimerRef.current = null;
    }
  }, []);

  /**
   * @param {string} [_reason]
   * @param {{ forceVisible?: boolean }} [options]
   */
  const runReconcile = useCallback(
    async (_reason, options = {}) => {
      if (!mountedRef.current) return;

      const forceVisible = options.forceVisible === true;
      if (!forceVisible && !userRef.current && !sessionErrorRef.current) {
        return;
      }

      const hadUser = Boolean(userRef.current);
      const wasHealthy =
        lifecycleRef.current === "SYNCED" && !sessionErrorRef.current && hadUser;
      const silent = !forceVisible && wasHealthy;

      reconcileInFlightRef.current = true;
      clearRecoveringUiTimer();

      if (!silent) {
        setLifecycle("RECOVERING");
      } else {
        recoveringUiTimerRef.current = setTimeout(() => {
          if (mountedRef.current && reconcileInFlightRef.current) {
            setLifecycle("RECOVERING");
          }
        }, RECOVERING_UI_DELAY_MS);
      }

      try {
        const me = await apiFetch("/api/v1/auth/me");
        if (!mountedRef.current) return;
        setUserState(mapUser(me?.data?.user));
        invalidateDerivedCaches();
        setSessionError(null);
        setSessionNotice(null);
        setLifecycle("SYNCED");
      } catch (e) {
        if (!mountedRef.current) return;
        clearRecoveringUiTimer();
        if (e instanceof ApiError && e.status === 401) {
          setUserState(null);
          setSessionError(null);
          setLifecycle("SYNCED");
        } else {
          setSessionError(
            e instanceof ApiError && e.user_message
              ? e.user_message
              : e instanceof Error
                ? e.message
                : "Could not reach the server",
          );
          setLifecycle("DEGRADED");
        }
      } finally {
        reconcileInFlightRef.current = false;
        clearRecoveringUiTimer();
      }
    },
    [clearRecoveringUiTimer],
  );

  const scheduleReconcile = useCallback(
    (reason) => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      reconcileTimerRef.current = setTimeout(() => {
        reconcileTimerRef.current = null;
        void runReconcile(reason);
      }, RECONCILE_DEBOUNCE_MS);
    },
    [runReconcile],
  );

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();

    async function bootstrap() {
      setLoading(true);
      setLifecycle("HYDRATING");
      setSessionError(null);
      try {
        const me = await fetchMeWithRetries(ac.signal);
        if (!mountedRef.current || ac.signal.aborted) return;
        setUserState(mapUser(me?.data?.user));
        setLifecycle("SYNCED");
      } catch (e) {
        if (e?.name === "AbortError" || ac.signal.aborted) return;
        if (!mountedRef.current) return;
        if (e instanceof ApiError && e.status === 401) {
          setUserState(null);
          setSessionError(null);
          setLifecycle("SYNCED");
        } else if (e instanceof ApiError && e.status >= 500) {
          setSessionError(e.user_message || e.message);
          setLifecycle("DEGRADED");
        } else {
          setSessionError(e instanceof Error ? e.message : "Could not reach the server");
          setLifecycle("DEGRADED");
        }
      } finally {
        if (mountedRef.current && !ac.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      mountedRef.current = false;
      ac.abort();
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      clearRecoveringUiTimer();
    };
  }, [clearRecoveringUiTimer]);

  useEffect(() => {
    const unsub = subscribeReconcile(({ reason }) => {
      scheduleReconcile(reason ?? "event");
    });
    return unsub;
  }, [scheduleReconcile]);

  useEffect(() => {
    return subscribeSessionInvalidated(() => {
      const hadUser = Boolean(userRef.current);
      setUserState(null);
      setSessionError(null);
      if (hadUser) {
        setSessionNotice("Your session ended. Please sign in again.");
      }
      setLifecycle("SYNCED");
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const isGuest =
        !userRef.current && !sessionErrorRef.current && !sessionNoticeRef.current;
      if (isGuest) return;
      const hadIssue = lifecycleRef.current === "DEGRADED" || Boolean(sessionErrorRef.current);
      if (hadIssue) {
        void (async () => {
          try {
            await apiFetch("/api/v1/auth/refresh", { method: "POST" });
            notifyRefreshCompleted();
          } catch {
            /* ignore — reconcile may still recover or surface 401 */
          }
          scheduleReconcile("visibility_recovery");
        })();
      } else {
        scheduleReconcile("visibility");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [scheduleReconcile]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onOnline = () => {
      if (!userRef.current && !sessionErrorRef.current && !sessionNoticeRef.current) {
        return;
      }
      scheduleReconcile("online");
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [scheduleReconcile]);

  useEffect(() => {
    if (loading) return;
    if (Date.now() < skipNavigationReconcileUntilRef.current) return;
    if (!user && !sessionError) return;
    scheduleReconcile("navigation");
  }, [pathname, loading, user, sessionError, scheduleReconcile]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch("/api/v1/auth/me");
      const next = mapUser(me?.data?.user);
      setUserState(next);
      invalidateDerivedCaches();
      setSessionError(null);
      setLifecycle("SYNCED");
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUserState(null);
        setSessionError(null);
        setLifecycle("SYNCED");
        return null;
      }
      setSessionError(e instanceof Error ? e.message : "Could not reach the server");
      setLifecycle("DEGRADED");
      return null;
    }
  }, []);

  const confirmSessionAfterAuth = useCallback(async () => {
    skipNavigationReconcileUntilRef.current = Date.now() + 2000;
    const me = await apiFetch("/api/v1/auth/me");
    const next = mapUser(me?.data?.user);
    if (!next) {
      throw new ApiError("Please sign in to continue.", {
        status: 401,
        code: "UNAUTHENTICATED",
        requires_reauth: true,
      });
    }
    setUserState(next);
    invalidateDerivedCaches();
    setSessionError(null);
    setSessionNotice(null);
    setLifecycle("SYNCED");
    return next;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    await apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: typeof email === "string" ? email.trim().toLowerCase() : email,
        password,
      }),
    });
    return confirmSessionAfterAuth();
  }, [confirmSessionAfterAuth]);

  const register = useCallback(async ({ username, email, password }) => {
    await apiFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: typeof username === "string" ? username.trim() : username,
        email: typeof email === "string" ? email.trim().toLowerCase() : email,
        password,
      }),
    });
    return confirmSessionAfterAuth();
  }, [confirmSessionAfterAuth]);

  const completeOAuth = useCallback(
    async (ticket) => {
      await apiFetch("/api/v1/auth/oauth/complete", {
        method: "POST",
        body: JSON.stringify({ ticket }),
      });
      return confirmSessionAfterAuth();
    },
    [confirmSessionAfterAuth],
  );

  const completeOAuthRegister = useCallback(
    async (ticket, username) => {
      await apiFetch("/api/v1/auth/oauth/register", {
        method: "POST",
        body: JSON.stringify({ ticket, username }),
      });
      return confirmSessionAfterAuth();
    },
    [confirmSessionAfterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Still drop client state; server clears cookies when reachable.
    }
    setUserState(null);
    invalidateDerivedCaches();
    setSessionError(null);
    setSessionNotice(null);
    setLifecycle("SYNCED");
  }, []);

  const dismissSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      sessionNotice,
      lifecycle,
      dismissSessionNotice,
      login,
      register,
      completeOAuth,
      completeOAuthRegister,
      logout,
      refreshUser,
      reconcileNow: runReconcile,
    }),
    [
      user,
      loading,
      sessionError,
      sessionNotice,
      lifecycle,
      dismissSessionNotice,
      login,
      register,
      completeOAuth,
      completeOAuthRegister,
      logout,
      refreshUser,
      runReconcile,
    ],
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
