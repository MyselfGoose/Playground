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
import { refreshSession } from "../session/coordinatedRefresh.js";
import { invalidateDerivedCaches } from "../reconciliation/leaderboardInvalidation.js";
import { subscribeReconcile } from "../reconciliation/reconciliationEvents.js";
import { clearAllLastRoomCodesForUser } from "../session/RoomSession.js";
import {
  startAccessTokenScheduler,
  stopAccessTokenScheduler,
  refreshOnVisibilityIfStale,
  refreshOnVisibilityForGuest,
  resetGuestVisibilityRefresh,
  setAccessTokenSchedulerInGame,
} from "../session/accessTokenScheduler.js";
import { logSessionEvent } from "../session/sessionTelemetry.js";
import {
  dispatchSessionInvalidated,
  SESSION_CROSS_TAB_KEY,
  subscribeSessionInvalidated,
} from "../session/sessionInvalidation.js";

/** @typedef {{ id: string; username: string; email: string; roles: string[]; avatarUrl: string | null; avatarEmoji: string | null; usernameChangedAt?: string | null; createdAt?: string | null }} AuthUser */

/** @typedef {'INIT'|'HYDRATING'|'SYNCED'|'DEGRADED'|'RECOVERING'} SessionLifecycle */

const UserContext = createContext(null);

const RECONCILE_DEBOUNCE_MS = 500;
/** Only surface RECOVERING UI if reconcile exceeds this (routine nav reconcile stays invisible). */
const RECOVERING_UI_DELAY_MS = 800;

/** @param {Record<string, unknown> | null | undefined} u */
function mapUser(u) {
  if (!u) return null;
  const id = u._id != null ? String(u._id) : u.id != null ? String(u.id) : "";
  const username = typeof u.username === "string" ? u.username : "";
  const avatarUrl =
    typeof u.avatarUrl === "string" && u.avatarUrl.trim() ? u.avatarUrl.trim() : null;
  const avatarEmoji =
    typeof u.avatarEmoji === "string" && u.avatarEmoji.trim() ? u.avatarEmoji.trim() : null;
  return {
    id,
    username,
    email: typeof u.email === "string" ? u.email : "",
    roles: Array.isArray(u.roles) ? u.roles.map(String) : [],
    avatarUrl,
    avatarEmoji,
    usernameChangedAt:
      typeof u.usernameChangedAt === "string" ? u.usernameChangedAt : u.usernameChangedAt ?? null,
    createdAt: typeof u.createdAt === "string" ? u.createdAt : u.createdAt ?? null,
  };
}

/** @param {AuthUser | null} a @param {AuthUser | null} b */
function usersEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.id !== b.id || a.username !== b.username || a.email !== b.email) return false;
  if (a.avatarUrl !== b.avatarUrl || a.avatarEmoji !== b.avatarEmoji) return false;
  if (a.roles.length !== b.roles.length) return false;
  for (let i = 0; i < a.roles.length; i += 1) {
    if (a.roles[i] !== b.roles[i]) return false;
  }
  return true;
}

/** @param {AuthUser | null} prev @param {AuthUser | null} next */
function mergeUserState(prev, next) {
  return usersEqual(prev, next) ? prev : next;
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

/**
 * Bootstrap session: retry /me on transient errors; on 401 attempt refresh before signing out.
 * @param {AbortSignal} signal
 */
async function bootstrapSession(signal) {
  try {
    const me = await fetchMeWithRetries(signal);
    return mapUser(me?.data?.user);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e;
    logSessionEvent("bootstrap_me_401");
    try {
      await refreshSession();
      logSessionEvent("bootstrap_refresh_ok");
      const retry = await apiFetch("/api/v1/auth/me", { signal });
      return mapUser(retry?.data?.user);
    } catch {
      logSessionEvent("bootstrap_refresh_fail");
      throw e;
    }
  }
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
        setUserState((prev) => mergeUserState(prev, mapUser(me?.data?.user)));
        invalidateDerivedCaches();
        setSessionError(null);
        setSessionNotice(null);
        setLifecycle("SYNCED");
      } catch (e) {
        if (!mountedRef.current) return;
        clearRecoveringUiTimer();
        if (e instanceof ApiError && e.status === 401) {
          if (hadUser) {
            try {
              await refreshSession();
              const retry = await apiFetch("/api/v1/auth/me");
              if (!mountedRef.current) return;
              setUserState((prev) => mergeUserState(prev, mapUser(retry?.data?.user)));
              invalidateDerivedCaches();
              setSessionError(null);
              setSessionNotice(null);
              setLifecycle("SYNCED");
              return;
            } catch {
              /* fall through to signed-out */
            }
          }
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
        const nextUser = await bootstrapSession(ac.signal);
        if (!mountedRef.current || ac.signal.aborted) return;
        setUserState((prev) => mergeUserState(prev, nextUser));
        resetGuestVisibilityRefresh();
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
    if (lifecycle === "SYNCED" && user) {
      startAccessTokenScheduler();
    } else if (!user) {
      stopAccessTokenScheduler();
      setAccessTokenSchedulerInGame({ inGame: false });
    }
    return () => {
      stopAccessTokenScheduler();
    };
  }, [lifecycle, user]);

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
    if (typeof window === "undefined") return undefined;
    /** @param {StorageEvent} e */
    const onStorage = (e) => {
      if (e.key !== SESSION_CROSS_TAB_KEY || !e.newValue) return;
      const hadUser = Boolean(userRef.current);
      setUserState(null);
      setSessionError(null);
      invalidateDerivedCaches();
      if (hadUser) {
        setSessionNotice("Your session ended. Please sign in again.");
      }
      setLifecycle("SYNCED");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const isGuest =
        !userRef.current && !sessionErrorRef.current && !sessionNoticeRef.current;
      if (isGuest) {
        refreshOnVisibilityForGuest();
        return;
      }
      const hadIssue = lifecycleRef.current === "DEGRADED" || Boolean(sessionErrorRef.current);
      refreshOnVisibilityIfStale();
      if (hadIssue) {
        void (async () => {
          try {
            await refreshSession();
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
    if (!userRef.current && !sessionErrorRef.current) return;
    scheduleReconcile("navigation");
  }, [pathname, loading, scheduleReconcile]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch("/api/v1/auth/me");
      const next = mapUser(me?.data?.user);
      setUserState((prev) => mergeUserState(prev, next));
      invalidateDerivedCaches();
      setSessionError(null);
      resetGuestVisibilityRefresh();
      setLifecycle("SYNCED");
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        try {
          await refreshSession();
          const retry = await apiFetch("/api/v1/auth/me");
          const next = mapUser(retry?.data?.user);
          setUserState((prev) => mergeUserState(prev, next));
          invalidateDerivedCaches();
          setSessionError(null);
          resetGuestVisibilityRefresh();
          setLifecycle("SYNCED");
          return next;
        } catch {
          /* fall through to signed-out */
        }
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
    resetGuestVisibilityRefresh();
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
    dispatchSessionInvalidated("logout");
    if (userRef.current?.id) {
      clearAllLastRoomCodesForUser(userRef.current.id);
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

  const updateProfile = useCallback(
    async ({ username }) => {
      const body = {};
      if (typeof username === "string" && username.trim()) {
        body.username = username.trim();
      }
      await apiFetch("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return refreshUser();
    },
    [refreshUser],
  );

  const uploadAvatar = useCallback(
    async (image) => {
      await apiFetch("/api/v1/users/me/avatar", {
        method: "POST",
        body: JSON.stringify({ image }),
      });
      return refreshUser();
    },
    [refreshUser],
  );

  const setAvatarEmoji = useCallback(
    async (emoji) => {
      await apiFetch("/api/v1/users/me/avatar/emoji", {
        method: "PUT",
        body: JSON.stringify({ emoji }),
      });
      return refreshUser();
    },
    [refreshUser],
  );

  const removeAvatar = useCallback(async () => {
    await apiFetch("/api/v1/users/me/avatar", { method: "DELETE" });
    return refreshUser();
  }, [refreshUser]);

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
      updateProfile,
      uploadAvatar,
      setAvatarEmoji,
      removeAvatar,
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
      updateProfile,
      uploadAvatar,
      setAvatarEmoji,
      removeAvatar,
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
