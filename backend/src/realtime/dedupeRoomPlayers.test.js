import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRoomPlayersByUserId, dedupeRoomPlayersInPlace } from './dedupeRoomPlayers.js';

test('dedupeRoomPlayersByUserId keeps first entry per userId', () => {
  const players = [
    { userId: 'u1', username: 'First' },
    { userId: 'u2', username: 'Other' },
    { userId: 'u1', username: 'Duplicate' },
  ];
  const out = dedupeRoomPlayersByUserId(players);
  assert.equal(out.length, 2);
  assert.equal(out[0].username, 'First');
  assert.equal(out[1].userId, 'u2');
});

test('dedupeRoomPlayersInPlace mutates room.players', () => {
  const room = {
    players: [
      { userId: 'a', ready: true },
      { userId: 'a', ready: false },
    ],
  };
  dedupeRoomPlayersInPlace(room);
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].ready, true);
});
