import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIBBAGE_POINTS_FOOL,
  FIBBAGE_POINTS_TRUTH,
  FIBBAGE_FINAL_ROUND_MULTIPLIER,
} from './constants.js';
import {
  normalizeSettings,
  initGame,
  submitLie,
  castVote,
  snapshotFor,
  getWinners,
  advancePhaseIfExpired,
} from './gameManager.js';

function connectedPlayer(userId, username) {
  return {
    userId,
    username,
    ready: true,
    score: 0,
    presenceStatus: 'connected',
  };
}

function createRoom(players) {
  return {
    settings: normalizeSettings({ roundCount: 2 }),
    players,
    usedPromptIds: new Set(),
    hostUserId: players[0].userId,
  };
}

const prompt = { id: 'p1', text: 'Test ______.', answer: 'truth', category: 'weird' };

test('normalizeSettings clamps values to allowed ranges', () => {
  const settings = normalizeSettings({ roundCount: 999, writingSeconds: 1, votingSeconds: 1000 });
  assert.equal(settings.roundCount, 10);
  assert.equal(settings.writingSeconds, 45);
  assert.equal(settings.votingSeconds, 90);
});

test('initGame requires at least three connected players', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
  ]);
  assert.throws(
    () => initGame(room, prompt),
    (e) => e.code === 'NOT_ENOUGH_PLAYERS',
  );
});

test('submitLie rejects duplicates and truth matches', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';

  submitLie(room, 'p1', 'My fake answer');
  submitLie(room, 'p2', 'Another fake');

  assert.throws(() => submitLie(room, 'p3', 'my fake answer'), (e) => e.code === 'DUPLICATE_LIE');
  assert.throws(() => submitLie(room, 'p3', 'truth'), (e) => e.code === 'TOO_CLOSE_TO_TRUTH');
});

test('voting snapshots do not leak authors or truth identity', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'My fake answer');
  submitLie(room, 'p2', 'Another fake');

  room.game.status = 'voting';
  room.game.answers = [
    { answerId: 'a1', text: 'My fake answer', authorUserId: 'p1', isTruth: false },
    { answerId: 'a2', text: 'Another fake', authorUserId: 'p2', isTruth: false },
    { answerId: 'a3', text: 'truth', authorUserId: null, isTruth: true },
  ];

  const snap = snapshotFor(room, 'p1');
  assert.ok(snap.game.answers.every((a) => a.authorUserId === null));
  assert.ok(snap.game.answers.every((a) => a.isTruth === false));
});

test('castVote rejects self votes', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'voting';
  room.game.answers = [
    { answerId: 'a1', text: 'My fake answer', authorUserId: 'p1', isTruth: false },
    { answerId: 'a2', text: 'truth', authorUserId: null, isTruth: true },
  ];

  assert.throws(() => castVote(room, 'p1', 'a1'), (e) => e.code === 'SELF_VOTE');
});

test('scoring updates player scores and session stats', async () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  room.game.roundMultiplier = FIBBAGE_FINAL_ROUND_MULTIPLIER;
  submitLie(room, 'p1', 'My fake answer');
  submitLie(room, 'p2', 'Another fake');

  const now = Date.now();
  room.game.phaseEndsAt = now - 1;
  await advancePhaseIfExpired(room, now, async () => null);
  assert.equal(room.game.status, 'voting');
  assert.ok(room.game.answers.length >= 3);

  const p1Answer = room.game.answers.find((a) => a.authorUserId === 'p1');
  const truthAnswer = room.game.answers.find((a) => a.isTruth);
  assert.ok(p1Answer);
  assert.ok(truthAnswer);

  castVote(room, 'p2', p1Answer.answerId);
  castVote(room, 'p3', truthAnswer.answerId);
  castVote(room, 'p1', truthAnswer.answerId);

  room.game.phaseEndsAt = now - 1;
  await advancePhaseIfExpired(room, now, async () => null);
  assert.equal(room.game.status, 'revealing');

  const foolPoints = FIBBAGE_POINTS_FOOL * FIBBAGE_FINAL_ROUND_MULTIPLIER;
  const truthPoints = FIBBAGE_POINTS_TRUTH * FIBBAGE_FINAL_ROUND_MULTIPLIER;

  assert.equal(room.players.find((p) => p.userId === 'p1').score, foolPoints + truthPoints);
  assert.equal(room.players.find((p) => p.userId === 'p3').score, truthPoints);

  assert.equal(room.game.sessionStats.p1.liesSubmitted, 1);
  assert.equal(room.game.sessionStats.p2.liesSubmitted, 1);
  assert.equal(room.game.sessionStats.p1.foolsEarned, 1);
  assert.equal(room.game.sessionStats.p3.truthsFound, 1);
  assert.equal(room.game.sessionStats.p1.truthsFound, 1);
});

test('getWinners returns all players tied at the top score', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  room.players[0].score = 1000;
  room.players[1].score = 1000;
  room.players[2].score = 500;
  room.game = { status: 'finished' };

  const winners = getWinners(room);
  assert.equal(winners.length, 2);
  assert.deepEqual(
    winners.map((w) => w.userId).sort(),
    ['p1', 'p2'],
  );
});
