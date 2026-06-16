import mongoose from 'mongoose';

/**
 * @param {() => Promise<unknown>} fn
 */
function runWhenMongoReady(fn) {
  if (mongoose.connection.readyState !== 1) return;
  void fn().catch(() => {
    /* invite cleanup is best-effort */
  });
}

/**
 * @param {string} gameSlug
 * @param {string} roomCode
 */
export function onRoomClosed(gameSlug, roomCode) {
  runWhenMongoReady(async () => {
    const { gameInviteService } = await import('../services/gameInviteService.js');
    await gameInviteService.cancelInvitesForRoom(gameSlug, roomCode, 'cancelled');
  });
}

/**
 * @param {string} gameSlug
 * @param {string} roomCode
 */
export function onRoomGameStarted(gameSlug, roomCode) {
  runWhenMongoReady(async () => {
    const { gameInviteService } = await import('../services/gameInviteService.js');
    await gameInviteService.cancelInvitesForRoom(gameSlug, roomCode, 'expired');
  });
}

/**
 * @param {string} gameSlug
 * @param {string} roomCode
 */
export function onRoomDestroyed(gameSlug, roomCode) {
  onRoomClosed(gameSlug, roomCode);
}
