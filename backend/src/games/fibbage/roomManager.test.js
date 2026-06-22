import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { FibbagePrompt } from '../../models/FibbagePrompt.js';
import { createFibbageRoomManager } from './roomManager.js';
import { initGame } from './gameManager.js';

function makeSocket(id, userId, username) {
  return {
    id,
    data: { userId, username, roles: [] },
    join() {},
    leave() {},
    emit() {},
  };
}

function makeNs() {
  return { sockets: new Map() };
}

function connectedPlayer(userId, username) {
  return {
    userId,
    username,
    ready: true,
    score: 0,
    presenceStatus: 'connected',
  };
}

const prompt = { id: 'p1', text: 'Test ______.', answer: 'truth', category: 'weird' };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('tick advances between_rounds to starting for the next round', async () => {
  const countMock = mock.method(FibbagePrompt, 'countDocuments', async () => 1);
  const findMock = mock.method(FibbagePrompt, 'findOne', () => ({
    skip() {
      return this;
    },
    async lean() {
      return {
        _id: 'p2',
        text: 'Another ______.',
        answer: 'answer',
        category: 'weird',
      };
    },
  }));

  try {
    const ns = makeNs();
    const manager = createFibbageRoomManager({ fibbageNs: ns, logger: console });
    const host = makeSocket('s1', 'u1', 'host');
    ns.sockets.set(host.id, host);

    const room = await manager.createRoom(host, {});
    room.players.push(
      connectedPlayer('u2', 'guest1'),
      connectedPlayer('u3', 'guest2'),
    );
    initGame(room, prompt);
    room.game.status = 'between_rounds';
    room.game.round = 1;
    room.game.phaseEndsAt = Date.now() - 1;

    manager.tick();
    await sleep(50);

    assert.equal(room.game.status, 'starting');
    assert.equal(room.game.round, 2);
    assert.equal(room.game.prompt.id, 'p2');
    assert.equal(room.phaseTransitionInFlight, false);
  } finally {
    countMock.mock.restore();
    findMock.mock.restore();
  }
});

test('tick does not advance between_rounds when phaseEndsAt was cleared before advance (regression)', async () => {
  const ns = makeNs();
  const manager = createFibbageRoomManager({ fibbageNs: ns, logger: console });
  const host = makeSocket('s1', 'u1', 'host');
  ns.sockets.set(host.id, host);

  const room = await manager.createRoom(host, {});
  room.players.push(
    connectedPlayer('u2', 'guest1'),
    connectedPlayer('u3', 'guest2'),
  );
  initGame(room, prompt);
  room.game.status = 'between_rounds';
  room.game.round = 1;
  room.game.phaseEndsAt = null;

  manager.tick();
  await sleep(50);

  assert.equal(room.game.status, 'between_rounds');
  assert.equal(room.game.round, 1);
});
