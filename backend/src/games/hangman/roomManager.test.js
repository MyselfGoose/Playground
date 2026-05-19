import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { hangmanWordRepository } from '../../repositories/hangmanWordRepository.js';
import { HANGMAN_SETTER_PICK_TIMEOUT_MS } from './constants.js';
import { autoAssignSetterWord, guessLetter, nextRound, setterSubmitWord, startGame } from './gameManager.js';
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

test('re-join same user during lobby countdown does not cancel countdown (RC-11)', async () => {
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
  await manager.setReady(host, true);
  await manager.setReady(guest, true);
  assert.ok(room.lobby?.countdownEndsAt);

  await manager.leaveRoom(guest, { hardLeave: false });
  const guestReconnect = makeSocket('s3', 'u2', 'guest');
  ns.sockets.set(guestReconnect.id, guestReconnect);
  await manager.joinRoom(guestReconnect, room.code);
  assert.ok(room.lobby?.countdownEndsAt, 'countdown should remain after same-user re-attach');
});

test('new player join during lobby countdown cancels countdown (RC-11)', async () => {
  const ns = makeNs();
  const manager = createHangmanRoomManager({ hangmanNs: ns, logger: console });
  const host = makeSocket('s1', 'u1', 'host');
  const guest = makeSocket('s2', 'u2', 'guest');
  const third = makeSocket('s3', 'u3', 'third');
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);
  ns.sockets.set(third.id, third);

  const room = await manager.createRoom(host, {});
  await manager.joinRoom(guest, room.code);
  room.players.forEach((p) => {
    p.ready = true;
  });
  await manager.setReady(host, true);
  await manager.setReady(guest, true);
  assert.ok(room.lobby?.countdownEndsAt);

  await manager.joinRoom(third, room.code);
  assert.equal(room.lobby?.countdownEndsAt, null);
});

test('playAgain after game_end starts lobby countdown', async () => {
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
  setterSubmitWord(room, 'u1', 'cats');
  guessLetter(room, 'u2', 'c');
  guessLetter(room, 'u2', 'a');
  guessLetter(room, 'u2', 't');
  guessLetter(room, 'u2', 's');
  nextRound(room, 'u1');
  setterSubmitWord(room, 'u2', 'frog');
  guessLetter(room, 'u1', 'f');
  guessLetter(room, 'u1', 'r');
  guessLetter(room, 'u1', 'o');
  guessLetter(room, 'u1', 'g');
  nextRound(room, 'u1');
  assert.equal(room.game.phase, 'game_end');

  manager.playAgain(host);
  assert.equal(room.game, null);
  assert.ok(room.lobby?.countdownEndsAt);
  assert.equal(room.players.every((p) => p.ready), true);

  await manager.leaveRoom(guest, { hardLeave: true });
  await manager.leaveRoom(host, { hardLeave: true });
});

test('soft disconnect timer does not mark user disconnected while another tab is connected (BUG-008)', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => {
    mock.timers.reset();
  });

  const ns = makeNs();
  const manager = createHangmanRoomManager({ hangmanNs: ns, logger: console });
  const tabA = makeSocket('s1', 'u1', 'host');
  const tabB = makeSocket('s2', 'u1', 'host');
  const guest = makeSocket('s3', 'u2', 'guest');
  ns.sockets.set(tabA.id, tabA);
  ns.sockets.set(tabB.id, tabB);
  ns.sockets.set(guest.id, guest);

  const room = await manager.createRoom(tabA, {});
  await manager.joinRoom(tabB, room.code);
  await manager.joinRoom(guest, room.code);
  room.players.forEach((p) => {
    p.ready = true;
  });
  startGame(room);

  await manager.leaveRoom(tabA, { hardLeave: false });
  mock.timers.tick(8000);
  const hostPlayer = room.players.find((p) => p.userId === 'u1');
  assert.equal(hostPlayer?.connected, true);

  await manager.leaveRoom(tabB, { hardLeave: true });
  await manager.leaveRoom(guest, { hardLeave: true });
});
