/**
 * Client-side room session helpers: last room code persistence and resume suppress flags.
 * Games with Mongo-backed rooms (NPAT) use suppress flags; in-memory games use session_resumed.
 */

const LAST_ROOM_PREFIX = "playgrounds:last-room:";
const SUPPRESS_PREFIX = "playgrounds:suppress-resume:";

/**
 * @param {string} gameId
 * @param {string} userId
 */
function scopedRoomKey(gameId, userId) {
  return `${LAST_ROOM_PREFIX}${gameId}:${userId}`;
}

/** @param {string} gameId */
function legacyRoomKey(gameId) {
  return `${LAST_ROOM_PREFIX}${gameId}`;
}

/**
 * @param {string} gameId e.g. `npat`, `cah`, `taboo`
 * @param {string} code
 * @param {string | null | undefined} userId
 */
export function persistLastRoomCode(gameId, code, userId) {
  if (typeof window === "undefined" || !gameId || !code || !userId) return;
  try {
    sessionStorage.setItem(scopedRoomKey(gameId, userId), String(code).toUpperCase());
    sessionStorage.removeItem(legacyRoomKey(gameId));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} gameId
 * @param {string | null | undefined} [userId]
 * @returns {string | null}
 */
export function readLastRoomCode(gameId, userId) {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    if (userId) {
      const scoped = sessionStorage.getItem(scopedRoomKey(gameId, userId));
      if (scoped && scoped.trim()) return scoped.trim();
    }
    const legacy = sessionStorage.getItem(legacyRoomKey(gameId));
    return legacy && legacy.trim() ? legacy.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Scan sessionStorage for any scoped last-room code for a game (userId unknown).
 * @param {string} gameId
 * @returns {string | null}
 */
export function findAnyLastRoomCode(gameId) {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const prefix = `${LAST_ROOM_PREFIX}${gameId}:`;
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const value = sessionStorage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
    const legacy = sessionStorage.getItem(legacyRoomKey(gameId));
    return legacy && legacy.trim() ? legacy.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} gameId
 * @param {string | null | undefined} [userId]
 */
export function clearLastRoomCode(gameId, userId) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    if (userId) {
      sessionStorage.removeItem(scopedRoomKey(gameId, userId));
    }
    sessionStorage.removeItem(legacyRoomKey(gameId));
  } catch {
    /* ignore */
  }
}

/**
 * Remove all scoped room codes for a user (call on logout).
 * @param {string} userId
 */
export function clearAllLastRoomCodesForUser(userId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const suffix = `:${userId}`;
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(LAST_ROOM_PREFIX) && key.endsWith(suffix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      sessionStorage.removeItem(key);
    }
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
