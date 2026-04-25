/**
 * Browser API client: cookies (httpOnly JWTs) are sent automatically; never persist tokens in JS.
 */

/**
 * Strip accidental `/api` or `/api/v1` suffix so paths like `/api/v1/auth/login` are not doubled.
 */
export function normalizeApiBase(raw) {
  let s = String(raw).trim();
  s = s.replace(/\/+$/, "");
  if (s.endsWith("/api/v1")) {
    s = s.slice(0, -"/api/v1".length);
  } else if (s.endsWith("/api")) {
    s = s.slice(0, -"/api".length);
  }
  return s.replace(/\/+$/, "");
}

function resolveApiBase() {
  const fromEnv =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? normalizeApiBase(process.env.NEXT_PUBLIC_API_URL)
      : "";
  if (fromEnv) return fromEnv;
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }
  return "";
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number; code?: string; body?: unknown }} [meta]
   */
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function buildUrl(path) {
  const base = API_BASE;
  if (!base && !path.startsWith("http")) {
    throw new ApiError(
      "Set NEXT_PUBLIC_API_URL to your API origin (e.g. http://localhost:4000).",
      { status: 0, code: "MISSING_API_BASE" },
    );
  }
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
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
    const errBody =
      json && typeof json === "object" && json !== null && "error" in json ? json : null;
    const message =
      errBody && typeof errBody.error === "object" && errBody.error !== null && "message" in errBody.error
        ? String(errBody.error.message)
        : res.statusText || "Request failed";
    const code =
      errBody && typeof errBody.error === "object" && errBody.error !== null && "code" in errBody.error
        ? String(errBody.error.code)
        : undefined;
    throw new ApiError(message, { status: res.status, code, body: json });
  }

  return json;
}

/**
 * In-flight refresh singleton: concurrent 401s share a single POST /auth/refresh. Subsequent
 * callers await the same promise, avoiding the rotation-race-with-itself scenario.
 *
 * @type {Promise<unknown> | null}
 */
let refreshInFlight = null;

/** Paths whose 401s should NOT trigger an automatic refresh. */
const NO_AUTO_REFRESH = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/feedback",
]);

function shouldAutoRefresh(path, options) {
  if (NO_AUTO_REFRESH.has(path)) return false;
  // Explicit opt-out from the caller (used by bootstrap where a 401 is expected before first refresh).
  if (options && options.noAutoRefresh) return false;
  return true;
}

/**
 * @param {string} path Absolute URL or path (joined with API_BASE)
 * @param {RequestInit & { noAutoRefresh?: boolean }} [options]
 */
export async function apiFetch(path, options = {}) {
  try {
    return await rawFetch(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !shouldAutoRefresh(path, options)) {
      throw err;
    }
    if (!refreshInFlight) {
      refreshInFlight = rawFetch("/api/v1/auth/refresh", { method: "POST" }).finally(() => {
        refreshInFlight = null;
      });
    }
    try {
      await refreshInFlight;
    } catch {
      throw err;
    }
    return rawFetch(path, options);
  }
}
