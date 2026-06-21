import { AppError } from '../errors/AppError.js';
import { getPlatformSettingsCached } from '../services/platformSettingsService.js';

/** @type {readonly string[]} */
export const GAME_SLUGS = ['npat', 'typing-race', 'taboo', 'cah', 'hangman'];

/**
 * @param {string} slug
 */
export function isGameEnabled(slug) {
  const settings = getPlatformSettingsCached();
  const disabled = settings.disabledGames ?? [];
  return !disabled.includes(slug);
}

/**
 * @param {string} slug
 * @param {{ isAdmin?: boolean }} [opts]
 */
export function canCreateRoom(slug, opts = {}) {
  if (opts.isAdmin) return true;
  const settings = getPlatformSettingsCached();
  if (settings.blockNewRooms) return false;
  return isGameEnabled(slug);
}

/**
 * @param {string} slug
 * @param {{ isAdmin?: boolean }} [opts]
 * @returns {string | null}
 */
export function roomCreationBlockReason(slug, opts = {}) {
  if (canCreateRoom(slug, opts)) return null;
  if (!isGameEnabled(slug)) return 'This game is temporarily unavailable';
  if (getPlatformSettingsCached().blockNewRooms) {
    return 'New rooms are temporarily disabled while existing games finish';
  }
  return 'Room creation is unavailable';
}

/**
 * @param {string} slug
 * @param {{ isAdmin?: boolean }} [opts]
 */
export function assertRoomCreationAllowed(slug, opts = {}) {
  const reason = roomCreationBlockReason(slug, opts);
  if (reason) {
    throw new AppError(503, reason, { code: 'ROOM_CREATION_BLOCKED', expose: true });
  }
}
