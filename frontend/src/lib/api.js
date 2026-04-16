/**
 * Browser API client: cookies (httpOnly JWTs) are sent automatically; never persist tokens in JS.
 */

function resolveApiBase() {
  const fromEnv =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? String(process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, "")
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

/**
 * @param {string} path Absolute URL or path (joined with API_BASE)
 * @param {RequestInit} [options]
 */
export async function apiFetch(path, options = {}) {
  const base = API_BASE;
  if (!base && !path.startsWith("http")) {
    throw new ApiError("Set NEXT_PUBLIC_API_URL to your API origin (e.g. http://localhost:4000).", {
      status: 0,
      code: "MISSING_API_BASE",
    });
  }

  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
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
    const errBody = json && typeof json === "object" && json !== null && "error" in json ? json : null;
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
