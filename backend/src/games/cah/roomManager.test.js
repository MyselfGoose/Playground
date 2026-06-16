import test from 'node:test';
import assert from 'node:assert/strict';
import { CahBlackCard } from '../../models/CahBlackCard.js';
import { CahWhiteCard } from '../../models/CahWhiteCard.js';
import * as cahLedger from '../../repositories/cahLeaderboardLedgerRepository.js';
import * as userStats from '../../repositories/userStatsRepository.js';
import { CAH_REVEALING_AUTO_ADVANCE_MS } from './constants.js';
import { createCahRoomManager } from './roomManager.js';

function mockSocket(id, userId, username = 'User') {
  return {
    id,
    data: { userId, username },
    join: () => {},
    leave: () => {},
    emit: () => {},
  };
}

function createMockNamespace() {
  const sockets = new Map();
  return { sockets };
}

function stubCardDecks(t) {
  const blackOrig = CahBlackCard.aggregate;
  const whiteOrig = CahWhiteCard.aggregate;
  const distinctOrig = CahBlackCard.distinct;
  CahBlackCard.distinct = async () => ['Base'];
  CahBlackCard.aggregate = async () => [{ sourceId: 1, text: 'Prompt _', pick: 1, pack: 'Base' }];
  let whiteCursor = 0;
  const whiteDeck = Array.from({ length: 40 }, (_, i) => ({
    sourceId: i + 100,
    text: `Card ${i}`,
    pack: 'Base',
  }));
  CahWhiteCard.aggregate = async (pipeline) => {
    const size = pipeline?.[1]?.$sample?.size ?? 1;
    const out = whiteDeck.slice(whiteCursor, whiteCursor + size);
    whiteCursor += size;
    return out;
  };
  t.after(() => {
    CahBlackCard.aggregate = blackOrig;
    CahWhiteCard.aggregate = whiteOrig;
    CahBlackCard.distinct = distinctOrig;
  });
}

function stubLeaderboardPersistence(t) {
  const ledgerOrig = {
    tryInsertRoundLedger: cahLedger.cahLeaderboardLedgerRepository.tryInsertRoundLedger,
    insertActivityForUsers: cahLedger.cahLeaderboardLedgerRepository.insertActivityForUsers,
    tryInsertGameLedger: cahLedger.cahLeaderboardLedgerRepository.tryInsertGameLedger,
  };
  const statsOrig = {
    applyCahSubmitterRound: userStats.userStatsRepository.applyCahSubmitterRound,
    applyCahJudgeRound: userStats.userStatsRepository.applyCahJudgeRound,
    applyCahGameCompleted: userStats.userStatsRepository.applyCahGameCompleted,
  };
  cahLedger.cahLeaderboardLedgerRepository.tryInsertRoundLedger = async () => true;
  cahLedger.cahLeaderboardLedgerRepository.insertActivityForUsers = async () => {};
  cahLedger.cahLeaderboardLedgerRepository.tryInsertGameLedger = async () => true;
  userStats.userStatsRepository.applyCahSubmitterRound = async () => {};
  userStats.userStatsRepository.applyCahJudgeRound = async () => {};
  userStats.userStatsRepository.applyCahGameCompleted = async () => {};
  t.after(() => {
    cahLedger.cahLeaderboardLedgerRepository.tryInsertRoundLedger = ledgerOrig.tryInsertRoundLedger;
    cahLedger.cahLeaderboardLedgerRepository.insertActivityForUsers = ledgerOrig.insertActivityForUsers;
    cahLedger.cahLeaderboardLedgerRepository.tryInsertGameLedger = ledgerOrig.tryInsertGameLedger;
    userStats.userStatsRepository.applyCahSubmitterRound = statsOrig.applyCahSubmitterRound;
    userStats.userStatsRepository.applyCahJudgeRound = statsOrig.applyCahJudgeRound;
    userStats.userStatsRepository.applyCahGameCompleted = statsOrig.applyCahGameCompleted;
  });
}

test('revealing auto-advances after 30s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  stubCardDecks(t);
  stubLeaderboardPersistence(t);

  const cahNs = createMockNamespace();
  const registry = createCahRoomManager({ cahNs, logger: null, maxPlayers: 10 });

  const hostSocket = mockSocket('h1', 'host1', 'Host');
  const judgeSocket = mockSocket('j1', 'judge1', 'Judge');
  const guestSocket = mockSocket('g1', 'guest1', 'Guest');
  cahNs.sockets.set('h1', hostSocket);
  cahNs.sockets.set('j1', judgeSocket);
  cahNs.sockets.set('g1', guestSocket);

  const room = await registry.createRoom(hostSocket, { maxRounds: 5 });
  await registry.joinRoom(judgeSocket, room.code);
  await registry.joinRoom(guestSocket, room.code);

  room.game = {
    gameSessionId: 'sess-1',
    status: 'judging',
    roundIndex: 1,
    judgeUserId: 'judge1',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [{ submissionId: 'sub-1', userId: 'guest1', cards: [{ sourceId: 1, text: 'x' }] }],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };

  await registry.judgePick(judgeSocket, 'sub-1');
  assert.equal(room.game.status, 'revealing');

  t.mock.timers.tick(CAH_REVEALING_AUTO_ADVANCE_MS);
  await new Promise((resolve) => setImmediate(resolve));
  assert.notEqual(room.game.status, 'revealing');

  t.mock.timers.reset();
  registry.shutdown();
});

test('manual advance clears revealing auto-advance timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  stubCardDecks(t);
  stubLeaderboardPersistence(t);

  const cahNs = createMockNamespace();
  const registry = createCahRoomManager({ cahNs, logger: null, maxPlayers: 10 });

  const hostSocket = mockSocket('h2', 'host2', 'Host');
  const judgeSocket = mockSocket('j2', 'judge2', 'Judge');
  const guestSocket = mockSocket('g2', 'guest2', 'Guest');
  cahNs.sockets.set('h2', hostSocket);
  cahNs.sockets.set('j2', judgeSocket);
  cahNs.sockets.set('g2', guestSocket);

  const room = await registry.createRoom(hostSocket, { maxRounds: 5 });
  await registry.joinRoom(judgeSocket, room.code);
  await registry.joinRoom(guestSocket, room.code);

  room.game = {
    gameSessionId: 'sess-2',
    status: 'judging',
    roundIndex: 1,
    judgeUserId: 'judge2',
    blackCard: { sourceId: 1, text: 'Prompt', pick: 1, pack: 'Base' },
    submissions: [{ submissionId: 'sub-2', userId: 'guest2', cards: [{ sourceId: 1, text: 'y' }] }],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };

  await registry.judgePick(judgeSocket, 'sub-2');
  await registry.advanceRound(hostSocket);
  assert.notEqual(room.game.status, 'revealing');

  const statusAfterManual = room.game.status;
  t.mock.timers.tick(CAH_REVEALING_AUTO_ADVANCE_MS);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(room.game.status, statusAfterManual);

  t.mock.timers.reset();
  registry.shutdown();
});

test('updateSettings rejects invalid packs', async (t) => {
  const distinctOrig = CahBlackCard.distinct;
  CahBlackCard.distinct = async () => ['Base', 'Expansion'];
  t.after(() => {
    CahBlackCard.distinct = distinctOrig;
  });

  const cahNs = createMockNamespace();
  const registry = createCahRoomManager({ cahNs, logger: null, maxPlayers: 10 });
  const hostSocket = mockSocket('host', 'host-user', 'Host');
  cahNs.sockets.set('host', hostSocket);

  const room = await registry.createRoom(hostSocket, { maxRounds: 5 });
  await assert.rejects(
    async () => registry.updateSettings(hostSocket, { packs: ['NotARealPack'] }),
    (err) => err.code === 'INVALID_PACKS',
  );
  await registry.updateSettings(hostSocket, { packs: ['Base'] });
  assert.deepEqual(room.settings.packs, ['Base']);

  registry.shutdown();
});

test('concurrent joinRoom from same user dedupes roster', async () => {
  const cahNs = createMockNamespace();
  const registry = createCahRoomManager({ cahNs, logger: null, maxPlayers: 10 });
  const hostSocket = mockSocket('host', 'host-user', 'Host');
  const tabASocket = mockSocket('tab-a', 'guest-user', 'Guest');
  const tabBSocket = mockSocket('tab-b', 'guest-user', 'Guest');
  cahNs.sockets.set('host', hostSocket);
  cahNs.sockets.set('tab-a', tabASocket);
  cahNs.sockets.set('tab-b', tabBSocket);

  const room = await registry.createRoom(hostSocket, { maxRounds: 5 });
  await Promise.all([
    registry.joinRoom(tabASocket, room.code),
    registry.joinRoom(tabBSocket, room.code),
  ]);

  const guestEntries = room.players.filter((p) => p.userId === 'guest-user');
  assert.equal(guestEntries.length, 1);
  assert.equal(room.players.length, 2);

  registry.shutdown();
});
