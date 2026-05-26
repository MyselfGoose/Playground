import { PLAYER_DISCONNECT_GRACE_MS } from './constants.js';

/** @typedef {'connected' | 'disconnect_pending' | 'gone'} PresenceStatus */

/**
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null, disconnectPendingAtMs?: number | null }} player
 */
export function ensurePresenceFields(player) {
  if (!player.presenceStatus) {
    player.presenceStatus = player.connected === false ? 'gone' : 'connected';
  }
  if (player.graceEndsAtMs === undefined) player.graceEndsAtMs = null;
  if (player.disconnectPendingAtMs === undefined) player.disconnectPendingAtMs = null;
}

/**
 * Player still counts toward min players, submissions, turns, etc.
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus }} player
 */
export function isPlayerActiveInGame(player) {
  ensurePresenceFields(player);
  return player.presenceStatus === 'connected' || player.presenceStatus === 'disconnect_pending';
}

/**
 * @param {{ players: Array<{ connected?: boolean, presenceStatus?: PresenceStatus }> }} room
 */
export function activePlayersInRoom(room) {
  return room.players.filter(isPlayerActiveInGame);
}

/**
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null, disconnectPendingAtMs?: number | null }} player
 */
export function markPlayerConnected(player) {
  player.connected = true;
  player.presenceStatus = 'connected';
  player.graceEndsAtMs = null;
  player.disconnectPendingAtMs = null;
}

/**
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null, disconnectPendingAtMs?: number | null }} player
 * @param {number} [graceMs]
 */
export function markPlayerDisconnectPending(player, graceMs = PLAYER_DISCONNECT_GRACE_MS) {
  const now = Date.now();
  player.connected = true;
  player.presenceStatus = 'disconnect_pending';
  player.disconnectPendingAtMs = now;
  player.graceEndsAtMs = now + graceMs;
}

/**
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null, disconnectPendingAtMs?: number | null }} player
 */
export function markPlayerGone(player) {
  player.connected = false;
  player.presenceStatus = 'gone';
  player.graceEndsAtMs = null;
  player.disconnectPendingAtMs = null;
}

/**
 * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null }} player
 * @param {number} [now]
 */
export function snapshotPresenceFields(player, now = Date.now()) {
  ensurePresenceFields(player);
  const status = /** @type {PresenceStatus} */ (player.presenceStatus ?? 'connected');
  const graceEndsAtMs =
    status === 'disconnect_pending' && player.graceEndsAtMs != null ? player.graceEndsAtMs : null;
  const graceSecondsRemaining =
    graceEndsAtMs != null ? Math.max(0, Math.ceil((graceEndsAtMs - now) / 1000)) : 0;
  return {
    connected: status !== 'gone',
    presenceStatus: status,
    graceEndsAtMs,
    graceSecondsRemaining,
  };
}

/**
 * Per-room disconnect grace timers keyed by userId.
 * @param {{ graceMs?: number }} [options]
 */
export function createDisconnectGraceRegistry(options = {}) {
  const graceMs = options.graceMs ?? PLAYER_DISCONNECT_GRACE_MS;
  /** @type {Map<string, NodeJS.Timeout>} */
  const timers = new Map();

  /**
   * @param {string} userId
   */
  function clearGrace(userId) {
    const timer = timers.get(userId);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(userId);
  }

  /**
   * @param {string} userId
   * @param {() => void} onExpired
   * @param {{ connected?: boolean, presenceStatus?: PresenceStatus, graceEndsAtMs?: number | null, disconnectPendingAtMs?: number | null }} player
   */
  function scheduleGrace(userId, player, onExpired) {
    clearGrace(userId);
    markPlayerDisconnectPending(player, graceMs);
    const timer = setTimeout(() => {
      timers.delete(userId);
      onExpired();
    }, graceMs);
    timer.unref?.();
    timers.set(userId, timer);
  }

  return { graceMs, clearGrace, scheduleGrace };
}
