/**
 * Future API client — wire to Express backend when ready.
 * @example fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
 */
export const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
    : "";
