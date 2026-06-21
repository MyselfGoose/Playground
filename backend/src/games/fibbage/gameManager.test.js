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
  advanceRevealIfExpired,
  finalizeWritingIfReady,
  finalizeVotingIfReady,
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

test('submitLie rejects resubmission', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'My fake answer');
  assert.throws(() => submitLie(room, 'p1', 'Another fake'), (e) => e.code === 'ALREADY_SUBMITTED');
});

test('castVote rejects revote', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'voting';
  room.game.answers = [
    { answerId: 'a1', text: 'My fake answer', authorUserId: 'p1', isTruth: false },
    { answerId: 'a2', text: 'Another fake', authorUserId: 'p2', isTruth: false },
    { answerId: 'a3', text: 'truth', authorUserId: null, isTruth: true },
  ];
  castVote(room, 'p1', 'a2');
  assert.throws(() => castVote(room, 'p1', 'a3'), (e) => e.code === 'ALREADY_VOTED');
});

test('finalizeWritingIfReady advances when all active players submitted', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'Lie one');
  submitLie(room, 'p2', 'Lie two');
  assert.equal(finalizeWritingIfReady(room, Date.now()), null);

  submitLie(room, 'p3', 'Lie three');
  const reason = finalizeWritingIfReady(room, Date.now());
  assert.equal(reason, 'voting_started');
  assert.equal(room.game.status, 'voting');
});

test('finalizeVotingIfReady advances when all active players voted', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'Lie one');
  submitLie(room, 'p2', 'Lie two');
  submitLie(room, 'p3', 'Lie three');
  finalizeWritingIfReady(room, Date.now());

  const p1Answer = room.game.answers.find((a) => a.authorUserId === 'p1');
  const p2Answer = room.game.answers.find((a) => a.authorUserId === 'p2');
  const truthAnswer = room.game.answers.find((a) => a.isTruth);
  assert.ok(p1Answer && p2Answer && truthAnswer);

  castVote(room, 'p1', p2Answer.answerId);
  castVote(room, 'p2', truthAnswer.answerId);
  assert.equal(finalizeVotingIfReady(room, Date.now()), null);

  castVote(room, 'p3', p1Answer.answerId);
  const reason = finalizeVotingIfReady(room, Date.now());
  assert.equal(reason, 'revealing_started');
  assert.equal(room.game.status, 'revealing');
});

test('advanceRevealIfExpired progresses through reveal sub-steps to scoring', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'Lie one');
  submitLie(room, 'p2', 'Lie two');
  submitLie(room, 'p3', 'Lie three');
  finalizeWritingIfReady(room, Date.now());

  const p1Answer = room.game.answers.find((a) => a.authorUserId === 'p1');
  const p2Answer = room.game.answers.find((a) => a.authorUserId === 'p2');
  const truthAnswer = room.game.answers.find((a) => a.isTruth);
  castVote(room, 'p1', p2Answer.answerId);
  castVote(room, 'p2', truthAnswer.answerId);
  castVote(room, 'p3', p1Answer.answerId);
  finalizeVotingIfReady(room, Date.now());

  assert.equal(room.game.status, 'revealing');
  assert.equal(room.game.reveal.step, 'votes_summary');

  let now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'reveal_step');
  assert.equal(room.game.reveal.step, 'per_lie');

  now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'reveal_step');
  assert.equal(room.game.reveal.step, 'per_lie');
  assert.equal(room.game.reveal.lieIndex, 1);

  now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'reveal_step');
  assert.equal(room.game.reveal.step, 'per_lie');
  assert.equal(room.game.reveal.lieIndex, 2);

  now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'reveal_step');
  assert.equal(room.game.reveal.step, 'truth');

  now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'reveal_step');
  assert.equal(room.game.reveal.step, 'complete');

  now = room.game.reveal.phaseEndsAt;
  assert.equal(advanceRevealIfExpired(room, now), 'scoring_started');
  assert.equal(room.game.status, 'scoring');
  assert.equal(room.game.reveal, null);
});

test('revealing snapshot exposes vote counts without voters at votes_summary', () => {
  const room = createRoom([
    connectedPlayer('p1', 'Alice'),
    connectedPlayer('p2', 'Bob'),
    connectedPlayer('p3', 'Charlie'),
  ]);
  initGame(room, prompt);
  room.game.status = 'writing';
  submitLie(room, 'p1', 'Lie one');
  submitLie(room, 'p2', 'Lie two');
  submitLie(room, 'p3', 'Lie three');
  finalizeWritingIfReady(room, Date.now());

  const p1Answer = room.game.answers.find((a) => a.authorUserId === 'p1');
  const p2Answer = room.game.answers.find((a) => a.authorUserId === 'p2');
  const truthAnswer = room.game.answers.find((a) => a.isTruth);
  castVote(room, 'p1', p2Answer.answerId);
  castVote(room, 'p2', truthAnswer.answerId);
  castVote(room, 'p3', p1Answer.answerId);
  finalizeVotingIfReady(room, Date.now());

  const snap = snapshotFor(room, 'p1');
  assert.equal(snap.game.reveal.step, 'votes_summary');
  assert.ok(snap.game.answers.every((a) => a.voters.length === 0));
  assert.ok(snap.game.answers.some((a) => a.voteCount > 0));
});
