import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activePlayersInRoom,
  createDisconnectGraceRegistry,
  isPlayerActiveInGame,
  markPlayerConnected,
  markPlayerDisconnectPending,
  markPlayerGone,
  snapshotPresenceFields,
} from './playerPresence.js';
import { PLAYER_DISCONNECT_GRACE_MS } from './constants.js';

test('disconnect_pending keeps player active in game', () => {
  const player = { userId: 'u1', connected: true };
  markPlayerDisconnectPending(player, 60_000);
  assert.equal(isPlayerActiveInGame(player), true);
  assert.equal(activePlayersInRoom({ players: [player] }).length, 1);
});

test('gone removes player from active set', () => {
  const player = { userId: 'u1', connected: false };
  markPlayerGone(player);
  assert.equal(isPlayerActiveInGame(player), false);
  assert.equal(activePlayersInRoom({ players: [player] }).length, 0);
});

test('grace registry fires onExpire after delay', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const registry = createDisconnectGraceRegistry({ graceMs: 1000 });
  const player = { userId: 'u1', connected: true };
  let expired = false;
  registry.scheduleGrace('u1', player, () => {
    expired = true;
  });
  assert.equal(player.presenceStatus, 'disconnect_pending');
  t.mock.timers.tick(1000);
  assert.equal(expired, true);
  t.mock.timers.reset();
});

test('snapshot includes grace countdown fields', () => {
  const player = { userId: 'u1', connected: true };
  markPlayerDisconnectPending(player, PLAYER_DISCONNECT_GRACE_MS);
  const snap = snapshotPresenceFields(player);
  assert.equal(snap.presenceStatus, 'disconnect_pending');
  assert.ok(snap.graceEndsAtMs > Date.now());
  assert.ok(snap.graceSecondsRemaining > 0);
});
