/**
 * Coordinated session invalidation: disconnect sockets and clear auth when refresh fails
 * or the API signals requires_reauth.
 */

import { shouldSuppressSocketTeardown } from "./gameSessionTeardown.js";

export const SESSION_INVALIDATED_EVENT = "playgrounds:session-invalidated";

/** localStorage key pinged on logout so other tabs tear down sockets and auth. */
export const SESSION_CROSS_TAB_KEY = "playgrounds:session-invalidated";

/** @typedef {(reason: string) => void} SocketTeardownFn */

/** @type {Set<SocketTeardownFn>} */
const socketTeardowns = new Set();

/**
 * Register a handler to disconnect game sockets when the session is invalidated.
 * @param {SocketTeardownFn} fn
 * @returns {() => void}
 */
export function registerSocketTeardown(fn) {
  socketTeardowns.add(fn);
  return () => {
    socketTeardowns.delete(fn);
  };
}

/** @param {string} [reason] */
export function runSocketTeardowns(reason = "session_invalidated") {
  if (shouldSuppressSocketTeardown()) return;
  for (const fn of socketTeardowns) {
    try {
      fn(reason);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * @param {string} [reason]
 */
export function dispatchSessionInvalidated(reason = "session_invalidated") {
  if (typeof window === "undefined") return;
  runSocketTeardowns(reason);
  try {
    localStorage.setItem(SESSION_CROSS_TAB_KEY, JSON.stringify({ reason, at: Date.now() }));
  } catch {
    /* private mode / quota */
  }
  window.dispatchEvent(
    new CustomEvent(SESSION_INVALIDATED_EVENT, { detail: { reason } }),
  );
}

/**
 * @param {(detail: { reason?: string }) => void} handler
 * @returns {() => void}
 */
export function subscribeSessionInvalidated(handler) {
  if (typeof window === "undefined") return () => {};
  /** @param {Event} e */
  const fn = (e) => {
    const d = /** @type {CustomEvent} */ (e).detail;
    handler(d ?? {});
  };
  window.addEventListener(SESSION_INVALIDATED_EVENT, fn);
  return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, fn);
}

/** User-facing copy for socket/API auth failures (never raw UNAUTHENTICATED). */
export const SESSION_EXPIRED_MESSAGE = "Session expired. Please sign in again.";

/**
 * @param {string | undefined} message
 */
export function isSocketAuthErrorMessage(message) {
  return message === "UNAUTHENTICATED" || message === "SESSION_REVOKED";
}

/**
 * @param {string | undefined} message
 */
export function socketAuthUserMessage(message) {
  if (message === "SESSION_REVOKED") {
    return "Your session ended. Please sign in again.";
  }
  if (message === "UNAUTHENTICATED") {
    return "Please sign in to continue.";
  }
  return SESSION_EXPIRED_MESSAGE;
}
