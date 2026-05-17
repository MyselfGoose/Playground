import { getSocketBase } from "../api.js";

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
  const base = getSocketBase();
  if (!base) {
    return "";
  }
  const qs = new URLSearchParams({ next: safeNextPath(nextPath) });
  return `${base}/api/v1/auth/google?${qs.toString()}`;
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
};

/**
 * @param {string | null | undefined} code
 */
export function messageForGoogleOAuthError(code) {
  if (!code) return null;
  return GOOGLE_OAUTH_ERROR_MESSAGES[code] ?? "Google sign-in failed. Please try again.";
}
