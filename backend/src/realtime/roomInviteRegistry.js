/**
 * Per-game room accessors for validating game invites.
 *
 * @typedef {{
 *   exists: boolean,
 *   hostId: string | null,
 *   playerUserIds: string[],
 *   joinable: boolean,
 * }} RoomInviteContext
 *
 * @typedef {{
 *   getInviteContext: (code: string) => RoomInviteContext | null,
 * }} RoomInviteAccessor
 */

/** @type {Map<string, RoomInviteAccessor>} */
const accessors = new Map();

/**
 * @param {string} gameSlug
 * @param {RoomInviteAccessor} accessor
 */
export function registerRoomAccessor(gameSlug, accessor) {
  accessors.set(String(gameSlug), accessor);
}

/**
 * @param {string} gameSlug
 */
export function unregisterRoomAccessor(gameSlug) {
  accessors.delete(String(gameSlug));
}

/**
 * @param {string} gameSlug
 * @param {string} code
 * @returns {RoomInviteContext | null}
 */
export function getRoomInviteContext(gameSlug, code) {
  const accessor = accessors.get(String(gameSlug));
  if (!accessor) return null;
  return accessor.getInviteContext(code);
}

export function clearRoomInviteRegistry() {
  accessors.clear();
}
