import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { hangmanWordRepository } from '../../repositories/hangmanWordRepository.js';
import { HANGMAN_SETTER_PICK_TIMEOUT_MS } from './constants.js';
import { autoAssignSetterWord, startGame } from './gameManager.js';
import { createHangmanRoomManager } from './roomManager.js';

function makeSocket(id, userId, username) {
  return {
    id,
    data: { userId, username },
    join() {},
    leave() {},
    emit() {},
  };
}

function makeNs() {
  return { sockets: new Map() };
}

test('soft disconnect does not immediately drop game or rotate host', async () => {
  const ns = makeNs();
  const manager = createHangmanRoomManager({ hangmanNs: ns, logger: console });
  const host = makeSocket('s1', 'u1', 'host');
  const guest = makeSocket('s2', 'u2', 'guest');
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);

  const room = await manager.createRoom(host, {});
  await manager.joinRoom(guest, room.code);
  room.players.forEach((p) => {
    p.ready = true;
  });
  startGame(room);
  assert.equal(room.game?.phase, 'setter_pick');
  assert.equal(room.hostId, 'u1');

  await manager.leaveRoom(host, { hardLeave: false });
  assert.equal(room.hostId, 'u1');
  assert.equal(room.game?.phase, 'setter_pick');

  const hostReconnect = makeSocket('s3', 'u1', 'host');
  ns.sockets.set(hostReconnect.id, hostReconnect);
  const resumed = await manager.attachActiveRoomForUser(hostReconnect);
  assert.equal(resumed?.code, room.code);
  assert.equal(room.hostId, 'u1');
  assert.equal(room.players.find((p) => p.userId === 'u1')?.connected, true);
  assert.equal(room.game?.phase, 'setter_pick');

  const origRandom = hangmanWordRepository.randomWord;
  hangmanWordRepository.randomWord = async () => ({ word: 'tiger' });
  await autoAssignSetterWord(room);
  hangmanWordRepository.randomWord = origRandom;

  await manager.leaveRoom(guest, { hardLeave: true });
  await manager.leaveRoom(hostReconnect, { hardLeave: true });
});

test('setter pick timeout auto-submits random word and starts guessing', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => {
    mock.timers.reset();
  });

  const origRandom = hangmanWordRepository.randomWord;
  /** @type {() => void} */
  let resolveWordPicked;
  const wordPicked = new Promise((resolve) => {
    resolveWordPicked = resolve;
  });
  hangmanWordRepository.randomWord = async () => {
    resolveWordPicked();
    return { word: 'tiger' };
  };
  t.after(() => {
    hangmanWordRepository.randomWord = origRandom;
  });

  const ns = makeNs();
  const manager = createHangmanRoomManager({ hangmanNs: ns, logger: console });
  const host = makeSocket('s1', 'u1', 'host');
  const guest = makeSocket('s2', 'u2', 'guest');
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);

  const room = await manager.createRoom(host, {});
  await manager.joinRoom(guest, room.code);
  room.players.forEach((p) => {
    p.ready = true;
  });
  startGame(room);
  await manager.attachActiveRoomForUser(host);

  assert.equal(room.game?.phase, 'setter_pick');

  mock.timers.tick(HANGMAN_SETTER_PICK_TIMEOUT_MS);
  await wordPicked;

  assert.equal(room.game?.phase, 'guessing');
  assert.equal(room.game?.secretWord, 'tiger');

  await manager.leaveRoom(guest, { hardLeave: true });
  await manager.leaveRoom(host, { hardLeave: true });
});
