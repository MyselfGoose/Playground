/**
 * Room code length must match backend `NPAT_ROOM_CODE_LENGTH` (default 4).
 */
export function getNpatRoomCodeLength() {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_NPAT_ROOM_CODE_LENGTH : undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 4 && n <= 6) {
    return n;
  }
  return 4;
}

/**
 * Validate a user-entered room code. Throws with a structured `.code` on failure so callers can
 * surface the error inline. Does NOT silently pad or truncate — that let short codes accidentally
 * collide with real rooms.
 *
 * @param {unknown} raw
 * @param {number} [len]
 * @returns {string} digits string of exactly `len` characters
 */
export function formatJoinCodeForServer(raw, len = getNpatRoomCodeLength()) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) {
    const err = new Error("Room code is required");
    /** @type {any} */ (err).code = "ROOM_CODE_REQUIRED";
    throw err;
  }
  if (digits.length !== len) {
    const err = new Error(`Room code must be exactly ${len} digits`);
    /** @type {any} */ (err).code = "ROOM_CODE_INVALID_LENGTH";
    throw err;
  }
  return digits;
}

/**
 * Non-throwing validator for input onChange handlers. Returns null when the value is valid, or
 * a user-facing message otherwise.
 *
 * @param {unknown} raw
 * @param {number} [len]
 */
export function validateJoinCode(raw, len = getNpatRoomCodeLength()) {
  try {
    formatJoinCodeForServer(raw, len);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
