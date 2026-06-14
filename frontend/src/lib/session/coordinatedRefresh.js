/**
 * Single entry point for POST /auth/refresh — in-tab dedup + cross-tab Web Locks.
 * All callers (GameAuthGate, scheduler, recoverSocketAuth, apiFetch 401 retry) must use this.
 */

import { getApiBase, ApiError } from "../api.js";
import { withRefreshStorageLock } from "../refreshStorageMutex.js";
import { notifyRefreshCompleted, dispatchReconcile } from "../reconciliation/reconciliationEvents.js";
import { dispatchSessionInvalidated } from "./sessionInvalidation.js";

/** Web Locks API name for cross-tab refresh serialization. */
const LOCK_KEY = "playgrounds-auth-refresh";

/** Refresh failures with these codes mean the session cannot be recovered client-side. */
const SESSION_DEAD_REFRESH_CODES = new Set([
  "INVALID_REFRESH",
  "TOKEN_REUSE",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "UNAUTHENTICATED",
]);

/** @type {Promise<void> | null} */
let inflight = null;

/**
 * @param {string} path
 */
function buildRefreshUrl(path) {
  const base = getApiBase();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function rawRefreshFetch() {
  const res = await fetch(buildRefreshUrl("/api/v1/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });

  const text = await res.text();
  /** @type {unknown} */
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    if (json && typeof json === "object" && json !== null && "error" in json) {
      const errBody = json;
      const nested =
        errBody && typeof errBody.error === "object" && errBody.error !== null
          ? errBody.error
          : null;
      const rawMsg =
        nested && "message" in nested && typeof nested.message === "string"
          ? nested.message
          : res.statusText || "Request failed";
      const code =
        nested && "code" in nested && nested.code != null ? String(nested.code) : undefined;
      const requires_reauth =
        nested && "requires_reauth" in nested && typeof nested.requires_reauth === "boolean"
          ? nested.requires_reauth
          : undefined;
      throw new ApiError(rawMsg, { status: res.status, code, requires_reauth });
    }
    throw new ApiError(res.statusText || "Request failed", { status: res.status, body: json });
  }

  return json;
}

/**
 * Serialize refresh across tabs via Web Locks when available.
 */
async function refreshViaCoordinator() {
  const req = () => rawRefreshFetch();

  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_KEY, req);
  }
  if (typeof localStorage !== "undefined") {
    return withRefreshStorageLock(req);
  }
  return req();
}

/**
 * Perform a coordinated session refresh. Concurrent callers share one in-flight request
 * and cross-tab Web Locks prevent TOKEN_REUSE from parallel rotations.
 *
 * @returns {Promise<void>}
 */
export function refreshSession() {
  if (inflight) return inflight;
  inflight = refreshViaCoordinator()
    .then(() => {
      notifyRefreshCompleted();
    })
    .catch((e) => {
      dispatchReconcile("refresh_failed");
      if (
        e instanceof ApiError &&
        (e.requires_reauth ||
          (typeof e.code === "string" && SESSION_DEAD_REFRESH_CODES.has(e.code)))
      ) {
        dispatchSessionInvalidated(e.code ?? "refresh_failed");
      }
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * @deprecated Prefer refreshSession — kept for existing imports.
 * @returns {Promise<void>}
 */
export function coordinatedRefresh() {
  return refreshSession();
}
