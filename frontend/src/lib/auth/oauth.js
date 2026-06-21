import { getApiBase, getSocketBase } from "../api.js";

/**
 * @param {unknown} raw
 */
export function safeNextPath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Google OAuth starts on the Railway API host (not the Vercel same-origin proxy).
 * @param {string} [nextPath]
 */
export function googleSignInHref(nextPath = "/") {
  const qs = new URLSearchParams({ next: safeNextPath(nextPath) });
  const socketBase = getSocketBase();
  if (socketBase) {
    return `${socketBase}/api/v1/auth/google?${qs.toString()}`;
  }
  // Same-origin API proxy: OAuth can start via Next rewrite to the backend.
  if (!getApiBase()) {
    return `/api/v1/auth/google?${qs.toString()}`;
  }
  return "";
}

/** @type {Record<string, string>} */
export const GOOGLE_OAUTH_ERROR_MESSAGES = {
  google_cancelled: "Google sign-in was cancelled.",
  GOOGLE_EMAIL_UNVERIFIED: "Your Google email must be verified before signing in.",
  GOOGLE_ACCOUNT_CONFLICT: "This Google account cannot be linked to your email.",
  GOOGLE_OAUTH_DISABLED: "Google sign-in is not available right now.",
  GOOGLE_OAUTH_FAILED: "Google sign-in failed. Please try again.",
  OAUTH_STATE_INVALID: "Sign-in could not be completed. Please try again.",
  OAUTH_TICKET_INVALID: "Your sign-in link expired. Please try Google sign-in again.",
  OAUTH_SIGNUP_TICKET_INVALID: "Your sign-up link expired. Please try Google sign-in again.",
  USERNAME_TAKEN: "That username is already taken. Try another.",
};

/**
 * @param {string | null | undefined} code
 */
export function messageForGoogleOAuthError(code) {
  if (!code) return null;
  return GOOGLE_OAUTH_ERROR_MESSAGES[code] ?? "Google sign-in failed. Please try again.";
}
