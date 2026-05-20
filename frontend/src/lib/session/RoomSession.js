/**
 * Client-side room session helpers: last room code persistence and resume suppress flags.
 * Games with Mongo-backed rooms (NPAT) use suppress flags; in-memory games use session_resumed.
 */

const LAST_ROOM_PREFIX = "playgrounds:last-room:";
const SUPPRESS_PREFIX = "playgrounds:suppress-resume:";

/**
 * @param {string} gameId e.g. `npat`, `cah`, `taboo`
 * @param {string} code
 */
export function persistLastRoomCode(gameId, code) {
  if (typeof window === "undefined" || !gameId || !code) return;
  try {
    sessionStorage.setItem(`${LAST_ROOM_PREFIX}${gameId}`, String(code).toUpperCase());
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} gameId
 * @returns {string | null}
 */
export function readLastRoomCode(gameId) {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const v = sessionStorage.getItem(`${LAST_ROOM_PREFIX}${gameId}`);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} gameId
 */
export function clearLastRoomCode(gameId) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    sessionStorage.removeItem(`${LAST_ROOM_PREFIX}${gameId}`);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} gameId
 * @param {boolean} suppressed
 */
export function setResumeSuppressed(gameId, suppressed) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    const key = `${SUPPRESS_PREFIX}${gameId}`;
    if (suppressed) {
      sessionStorage.setItem(key, "1");
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} gameId
 * @returns {boolean}
 */
export function isResumeSuppressed(gameId) {
  if (typeof window === "undefined" || !gameId) return false;
  try {
    if (gameId === "npat" && sessionStorage.getItem("npat_suppress_resume") === "1") {
      return true;
    }
    return sessionStorage.getItem(`${SUPPRESS_PREFIX}${gameId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Clears legacy and unified suppress keys (call on login).
 * @param {string} gameId
 */
export function clearResumeSuppress(gameId) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    if (gameId === "npat") {
      sessionStorage.removeItem("npat_suppress_resume");
    }
    sessionStorage.removeItem(`${SUPPRESS_PREFIX}${gameId}`);
  } catch {
    /* ignore */
  }
}
