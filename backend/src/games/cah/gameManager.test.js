import test from 'node:test';
import assert from 'node:assert/strict';
import { CahBlackCard } from '../../models/CahBlackCard.js';
import { CahWhiteCard } from '../../models/CahWhiteCard.js';
import {
  createCahRoom,
  judgePickWinner,
  nextRound,
  snapshotFor,
  startGame,
  submitCards,
} from './gameManager.js';

function createTwoPlayerRoom() {
  const room = createCahRoom('u1', 'Host', { maxRounds: 2, handSize: 3 });
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  return room;
}

test('CAH round lifecycle with 2-player synthetic submission', async (t) => {
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

  const room = createTwoPlayerRoom();
  await startGame(room);
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.game.blackCard.pick, 1);
  assert.equal(room.players.find((p) => p.userId === 'u2').hand.length, 3);

  const guestCardId = room.players.find((p) => p.userId === 'u2').hand[0].sourceId;
  await submitCards(room, 'u2', [guestCardId]);
  assert.equal(room.game.status, 'judging');
  assert.equal(room.game.submissions.length, 2);
  const playerSubmission = room.game.submissions.find((s) => !s.cpu);
  judgePickWinner(room, room.game.judgeUserId, playerSubmission.submissionId);
  assert.equal(room.game.status, 'revealing');
  assert.equal(room.players.find((p) => p.userId === 'u2').score, 1);

  await nextRound(room);
  assert.equal(room.game.status, 'submitting');
  assert.equal(room.game.roundIndex, 2);
});

test('snapshot hides submissions from non-judge during judging', () => {
  const room = createCahRoom('u1', 'Host', {});
  room.players.push({ userId: 'u2', username: 'Guest', ready: true, connected: true, score: 0 });
  room.players[0].ready = true;
  room.game = {
    status: 'judging',
    roundIndex: 1,
    judgeUserId: 'u1',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [{ submissionId: 's1', userId: 'u2', cards: [{ sourceId: 7, text: 'Answer' }], cpu: false }],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };
  const judgeSnap = snapshotFor(room, 'u1');
  const playerSnap = snapshotFor(room, 'u2');
  assert.equal(judgeSnap.game.submissions.length, 1);
  assert.equal(playerSnap.game.submissions.length, 0);
});
