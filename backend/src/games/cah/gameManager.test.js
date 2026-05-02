import test from 'node:test';
import assert from 'node:assert/strict';
import { CahBlackCard } from '../../models/CahBlackCard.js';
import { CahWhiteCard } from '../../models/CahWhiteCard.js';
import {
  createCahRoom,
  judgePickWinner,
  nextRound,
  reconcileRoomAfterMembershipChange,
  snapshotFor,
  startGame,
  submitCards,
} from './gameManager.js';

function createThreePlayerRoom() {
  const room = createCahRoom('u1', 'Host', { maxRounds: 2, handSize: 3 });
  room.players.push({ userId: 'u2', username: 'Guest-1', ready: true, connected: true, score: 0 });
  room.players.push({ userId: 'u3', username: 'Guest-2', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  return room;
}

test('startGame rejects fewer than 3 connected players', async () => {
  const room = createCahRoom('u1', 'Host', { maxRounds: 2 });
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  await assert.rejects(
    async () => startGame(room),
    /Minimum 3 players required to start/i,
  );
});

test('CAH round lifecycle with 3-player judge flow', async (t) => {
  const blackOrig = CahBlackCard.aggregate;
  const whiteOrig = CahWhiteCard.aggregate;

  let whiteCursor = 0;
  const whiteDeck = [
    { sourceId: 11, text: 'Card A', pack: 'Base' },
    { sourceId: 12, text: 'Card B', pack: 'Base' },
    { sourceId: 13, text: 'Card C', pack: 'Base' },
    { sourceId: 14, text: 'Card D', pack: 'Base' },
    { sourceId: 15, text: 'Card E', pack: 'Base' },
    { sourceId: 16, text: 'Card F', pack: 'Base' },
  ];

  CahBlackCard.aggregate = async () => [{ sourceId: 1, text: "Why can't I sleep at night? _", pick: 1, pack: 'Base' }];
  CahWhiteCard.aggregate = async (pipeline) => {
    const size = pipeline?.[1]?.$sample?.size ?? 1;
    const out = whiteDeck.slice(whiteCursor, whiteCursor + size);
    whiteCursor += size;
    return out;
  };

  t.after(() => {
    CahBlackCard.aggregate = blackOrig;
    CahWhiteCard.aggregate = whiteOrig;
  });

  const room = createThreePlayerRoom();
  await startGame(room);
  assert.ok(typeof room.game.gameSessionId === 'string' && room.game.gameSessionId.length > 0);
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.game.blackCard.pick, 1);
  assert.equal(room.game.judgeUserId, 'u2');
  assert.equal(room.players.find((p) => p.userId === 'u1').hand.length, 3);
  assert.equal(Array.isArray(room.players.find((p) => p.userId === 'u2').hand), false);
  assert.equal(room.players.find((p) => p.userId === 'u3').hand.length, 3);

  const guest2CardId = room.players.find((p) => p.userId === 'u3').hand[0].sourceId;
  await assert.rejects(() => submitCards(room, 'u2', [999]), /Judge cannot submit cards/i);
  await submitCards(room, 'u1', [room.players.find((p) => p.userId === 'u1').hand[0].sourceId]);
  assert.equal(room.game.status, 'submitting');
  await submitCards(room, 'u3', [guest2CardId]);
  assert.equal(room.game.status, 'judging');

  const winningSubmission = room.game.submissions.find((s) => s.userId === 'u3');
  judgePickWinner(room, 'u2', winningSubmission.submissionId);
  assert.equal(room.game.status, 'revealing');
  assert.equal(room.players.find((p) => p.userId === 'u3').score, 1);

  await nextRound(room);
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.game.roundIndex, 2);
  assert.equal(room.game.judgeUserId, 'u3');
});

test('snapshot hides submissions from non-judge during judging', () => {
  const room = createCahRoom('u1', 'Host', {});
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0 });
  room.players.push({ userId: 'u3', username: 'Guest-2', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  room.game = {
    status: 'judging',
    roundIndex: 1,
    judgeUserId: 'u1',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [
      { submissionId: 's1', userId: 'u2', cards: [{ sourceId: 7, text: 'Answer' }] },
      { submissionId: 's2', userId: 'u3', cards: [{ sourceId: 8, text: 'Answer 2' }] },
    ],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };
  const judgeSnap = snapshotFor(room, 'u1');
  const playerSnap = snapshotFor(room, 'u2');
  assert.equal(judgeSnap.game.submissions.length, 2);
  assert.equal(playerSnap.game.submissions.length, 0);
});

test('reconcile moves stalled submitting to waiting_players when everyone disconnects', async () => {
  const room = createCahRoom('u1', 'Host', {});
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0, hand: [] });
  room.players.push({ userId: 'u3', username: 'Guest-2', ready: true, connected: true, score: 0, hand: [] });
  room.players[0].ready = true;
  room.game = {
    status: 'submitting',
    roundIndex: 1,
    judgeUserId: 'u1',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };
  room.players[0].connected = false;
  room.players[1].connected = false;
  room.players[2].connected = false;
  await reconcileRoomAfterMembershipChange(room);
  assert.equal(room.game.status, 'waiting_players');
});

test('reconcile recovers waiting_players back to submitting when players reconnect', async () => {
  const room = createCahRoom('u1', 'Host', { handSize: 3 });
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0 });
  room.players.push({ userId: 'u3', username: 'Guest-2', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  room.players[0].hand = [{ sourceId: 101, text: 'Host card', pack: 'Base' }];
  room.players[1].hand = [{ sourceId: 102, text: 'Guest card', pack: 'Base' }];
  room.players[2].hand = [];
  room.game = {
    status: 'waiting_players',
    roundIndex: 1,
    judgeUserId: 'u1',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };

  const whiteOrig = CahWhiteCard.aggregate;
  let whiteCursor = 0;
  const whiteDeck = [
    { sourceId: 11, text: 'Card A', pack: 'Base' },
    { sourceId: 12, text: 'Card B', pack: 'Base' },
    { sourceId: 13, text: 'Card C', pack: 'Base' },
    { sourceId: 14, text: 'Card D', pack: 'Base' },
    { sourceId: 15, text: 'Card E', pack: 'Base' },
  ];
  CahWhiteCard.aggregate = async (pipeline) => {
    const size = pipeline?.[1]?.$sample?.size ?? 1;
    const out = whiteDeck.slice(whiteCursor, whiteCursor + size);
    whiteCursor += size;
    return out;
  };
  try {
    await reconcileRoomAfterMembershipChange(room);
  } finally {
    CahWhiteCard.aggregate = whiteOrig;
  }
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.players[1].hand.length, 3);
  assert.equal(room.players[2].hand.length, 3);
});

test('4-player round completes and judge rotates next round', async (t) => {
  const room = createCahRoom('u1', 'Host', { maxRounds: 3, handSize: 3 });
  room.players.push({ userId: 'u2', username: 'P2', ready: true, connected: true, score: 0 });
  room.players.push({ userId: 'u3', username: 'P3', ready: true, connected: true, score: 0 });
  room.players.push({ userId: 'u4', username: 'P4', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;

  const blackOrig = CahBlackCard.aggregate;
  const whiteOrig = CahWhiteCard.aggregate;
  let whiteCursor = 0;
  const whiteDeck = Array.from({ length: 30 }, (_, i) => ({ sourceId: i + 100, text: `Card ${i + 1}`, pack: 'Base' }));
  CahBlackCard.aggregate = async () => [{ sourceId: 1, text: 'Prompt _', pick: 1, pack: 'Base' }];
  CahWhiteCard.aggregate = async (pipeline) => {
    const size = pipeline?.[1]?.$sample?.size ?? 1;
    const out = whiteDeck.slice(whiteCursor, whiteCursor + size);
    whiteCursor += size;
    return out;
  };
  t.after(() => {
    CahBlackCard.aggregate = blackOrig;
    CahWhiteCard.aggregate = whiteOrig;
  });

  await startGame(room);
  assert.equal(room.game.judgeUserId, 'u2');
  await submitCards(room, 'u1', [room.players.find((p) => p.userId === 'u1').hand[0].sourceId]);
  await submitCards(room, 'u3', [room.players.find((p) => p.userId === 'u3').hand[0].sourceId]);
  await submitCards(room, 'u4', [room.players.find((p) => p.userId === 'u4').hand[0].sourceId]);
  assert.equal(room.game.status, 'judging');
  const pick = room.game.submissions.find((s) => s.userId === 'u3');
  judgePickWinner(room, 'u2', pick.submissionId);
  assert.equal(room.game.status, 'revealing');
  await nextRound(room);
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.game.judgeUserId, 'u3');
});
