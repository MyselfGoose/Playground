/**
 * Browser API client: cookies (httpOnly JWTs) are sent automatically; never persist tokens in JS.
 *
 * API origin resolution order:
 * 1) `NEXT_PUBLIC_SAME_ORIGIN_API` → empty base (same-origin `/api/v1`, Next rewrite proxy).
 * 2) Runtime injection `window.__PLAYGROUNDS_CONFIG__` from RootLayout (Vercel env read at request time).
 * 3) Build-time `process.env.NEXT_PUBLIC_API_URL` (classic Next inlining).
 *
 * (2) fixes deployments where the client bundle was built without `NEXT_PUBLIC_*` but the variable exists at runtime on the server.
 */

import { dispatchSessionInvalidated } from "./session/sessionInvalidation.js";
import { refreshSession } from "./session/coordinatedRefresh.js";

/**
 * Strip accidental `/api` or `/api/v1` suffix so paths like `/api/v1/auth/login` are not doubled.
 */
export function normalizeApiBase(raw) {
  let s = String(raw).trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  s = s.replace(/\/+$/, "");
  if (s.endsWith("/api/v1")) {
    s = s.slice(0, -"/api/v1".length);
  } else if (s.endsWith("/api")) {
    s = s.slice(0, -"/api".length);
  }
  return s.replace(/\/+$/, "");
}

function trimmedEnv(key) {
  if (typeof process === "undefined") return "";
  const v = process.env[key];
  return typeof v === "string" ? v.trim() : "";
}

function sameOriginApiMode() {
  const v = trimmedEnv("NEXT_PUBLIC_SAME_ORIGIN_API");
  return v === "1" || v.toLowerCase() === "true";
}

/** @returns {{ apiBase?: string, socketUrl?: string } | null} */
function readInjectedConfig() {
  if (typeof window === "undefined") return null;
  const c = window.__PLAYGROUNDS_CONFIG__;
  return c && typeof c === "object" ? c : null;
}

function resolveApiBaseFromEnvOnly() {
  if (sameOriginApiMode()) return "";

  const fromEnv = trimmedEnv("NEXT_PUBLIC_API_URL");
  if (fromEnv) return normalizeApiBase(fromEnv);

  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }
  return "";
}

/**
 * Resolved REST API origin (no path). Empty string means same-origin relative `/api/v1`.
 */
export function getApiBase() {
  if (sameOriginApiMode()) return "";

  const cfg = readInjectedConfig();
  if (cfg && typeof cfg.apiBase === "string" && cfg.apiBase.trim()) {
    return normalizeApiBase(cfg.apiBase);
  }

  return resolveApiBaseFromEnvOnly();
}

/**
 * Socket.IO origin (Railway / API host). Uses explicit socket URL when REST is proxied same-origin.
 */
export function getSocketBase() {
  const cfg = readInjectedConfig();
  if (cfg && typeof cfg.socketUrl === "string" && cfg.socketUrl.trim()) {
    return normalizeApiBase(cfg.socketUrl);
  }

  const sockEnv = trimmedEnv("NEXT_PUBLIC_SOCKET_URL");
  if (sockEnv) return normalizeApiBase(sockEnv);

  const api = getApiBase();
  if (api) return api;

  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }
  return "";
}

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   status?: number,
   *   code?: string,
   *   body?: unknown,
   *   category?: string,
   *   recoverable?: boolean,
   *   retryable?: boolean,
   *   requires_reauth?: boolean,
   *   user_message?: string,
   * }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "ApiError";
    this.status = meta.status;
    this.code = meta.code;
    this.body = meta.body;
    this.category = meta.category;
    this.recoverable = meta.recoverable;
    this.retryable = meta.retryable;
    this.requires_reauth = meta.requires_reauth;
    this.user_message = meta.user_message;
  }
}

/**
 * Absolute URL for browser fetch to the REST API (same-origin relative path when base is empty).
 * @param {string} path e.g. `/api/v1/foo`
 */
export function apiUrl(path) {
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  if (!base) return p;
  return `${base}${p}`;
}

function buildUrl(path) {
  if (path.startsWith("http")) return path;
  const base = getApiBase();
  if (!base) {
    const p = path.startsWith("/") ? path : `/${path}`;
    return p;
  }
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * @param {unknown} json
 */
function parseUnifiedApiError(json, res) {
  const errBody =
    json && typeof json === "object" && json !== null && "error" in json ? json : null;
  const nested =
    errBody && typeof errBody.error === "object" && errBody.error !== null ? errBody.error : null;

  const rawMsg =
    nested && "message" in nested && typeof nested.message === "string"
      ? nested.message
      : res.statusText || "Request failed";
  const userMsg =
    nested && "user_message" in nested && typeof nested.user_message === "string"
      ? nested.user_message
      : rawMsg;
  const code =
    nested && "code" in nested && nested.code != null ? String(nested.code) : undefined;
  const category =
    nested && "category" in nested && typeof nested.category === "string"
      ? nested.category
      : undefined;
  const recoverable =
    nested && "recoverable" in nested && typeof nested.recoverable === "boolean"
      ? nested.recoverable
      : undefined;
  const retryable =
    nested && "retryable" in nested && typeof nested.retryable === "boolean"
      ? nested.retryable
      : undefined;
  const requires_reauth =
    nested && "requires_reauth" in nested && typeof nested.requires_reauth === "boolean"
      ? nested.requires_reauth
      : undefined;

  return new ApiError(userMsg || rawMsg, {
    status: res.status,
    code,
    body: json,
    category,
    recoverable,
    retryable,
    requires_reauth,
    user_message: userMsg,
  });
}

async function rawFetch(path, options = {}) {
  const url = buildUrl(path);
  const { headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders ?? undefined);
  if (rest.body != null && typeof rest.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    credentials: "include",
    headers,
    ...rest,
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
      throw parseUnifiedApiError(json, res);
    }
    throw new ApiError(res.statusText || "Request failed", { status: res.status, body: json });
  }

  return json;
}

const NO_AUTO_REFRESH = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/me",
  "/api/v1/feedback",
]);

function shouldAutoRefresh(path, options) {
  if (NO_AUTO_REFRESH.has(path)) return false;
  if (options && options.noAutoRefresh) return false;
  return true;
}

/**
 * @param {string} path Absolute URL or path (joined with getApiBase())
 * @param {RequestInit & { noAutoRefresh?: boolean }} [options]
 */
export async function apiFetch(path, options = {}) {
  try {
    return await rawFetch(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !shouldAutoRefresh(path, options)) {
      throw err;
    }
    try {
      await refreshSession();
    } catch {
      throw err;
    }
    try {
      return await rawFetch(path, options);
    } catch (retryErr) {
      if (retryErr instanceof ApiError && retryErr.requires_reauth) {
        dispatchSessionInvalidated(retryErr.code ?? "requires_reauth");
      }
      throw retryErr;
    }
  }
}
