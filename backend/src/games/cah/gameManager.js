import crypto from 'node:crypto';
import { CahBlackCard } from '../../models/CahBlackCard.js';
import { CahWhiteCard } from '../../models/CahWhiteCard.js';
import { CAH_DEFAULT_HAND_SIZE, CAH_DEFAULT_MAX_ROUNDS, CAH_MIN_PLAYERS } from './constants.js';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function sanitizePacks(input) {
  const packs = Array.isArray(input) ? input.map((p) => String(p ?? '').trim()).filter(Boolean) : [];
  return [...new Set(packs)];
}

function nextJudge(players, currentJudgeId) {
  if (!players.length) return null;
  const idx = players.findIndex((p) => p.userId === currentJudgeId);
  const start = idx >= 0 ? idx + 1 : 0;
  for (let i = 0; i < players.length; i += 1) {
    const p = players[(start + i) % players.length];
    if (p.connected !== false) return p.userId;
  }
  return players[start % players.length].userId;
}

async function drawRandomBlackCard(room, pick = null) {
  const match = {
    datasetVersion: room.datasetVersion,
    sourceId: { $nin: [...room.usedBlackSourceIds] },
  };
  if (room.settings.packs.length) match.pack = { $in: room.settings.packs };
  if (pick != null) match.pick = pick;
  let cards = await CahBlackCard.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
  if (!cards.length) {
    room.usedBlackSourceIds.clear();
    const recycledMatch = { ...match, sourceId: { $nin: [] } };
    cards = await CahBlackCard.aggregate([{ $match: recycledMatch }, { $sample: { size: 1 } }]);
    if (cards.length) room.deckRecycled = true;
  }
  return cards[0] ?? null;
}

async function drawRandomWhiteCards(room, userId, size) {
  const usedGlobal = room.usedWhiteSourceIds;
  const userUsed = room.usedWhiteSourceIdsByUser.get(userId) ?? new Set();
  const blocked = [...new Set([...usedGlobal, ...userUsed])];
  const match = {
    datasetVersion: room.datasetVersion,
    sourceId: { $nin: blocked },
  };
  if (room.settings.packs.length) match.pack = { $in: room.settings.packs };
  let cards = await CahWhiteCard.aggregate([{ $match: match }, { $sample: { size } }]);
  if (cards.length < size) {
    userUsed.clear();
    room.usedWhiteSourceIdsByUser.set(userId, userUsed);
    const fallbackMatch = {
      datasetVersion: room.datasetVersion,
      sourceId: { $nin: [...usedGlobal] },
    };
    if (room.settings.packs.length) fallbackMatch.pack = { $in: room.settings.packs };
    cards = await CahWhiteCard.aggregate([{ $match: fallbackMatch }, { $sample: { size } }]);
    if (cards.length < size) {
      room.usedWhiteSourceIds.clear();
      cards = await CahWhiteCard.aggregate([
        { $match: { datasetVersion: room.datasetVersion, ...(room.settings.packs.length ? { pack: { $in: room.settings.packs } } : {}) } },
        { $sample: { size } },
      ]);
      if (cards.length) room.deckRecycled = true;
    }
  }
  return cards;
}

function mapPublicPlayers(room) {
  return room.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    ready: p.ready,
    connected: p.connected,
    score: p.score,
  }));
}

function isJudge(room, userId) {
  return room.game && room.game.judgeUserId === userId;
}

function viewerPermissions(room, userId) {
  const inRoom = room.players.some((p) => p.userId === userId);
  const me = room.players.find((p) => p.userId === userId);
  const status = room.game?.status ?? 'lobby';
  const submitted = room.game?.submissions.some((s) => s.userId === userId);
  return {
    canStart: inRoom && room.hostId === userId && status === 'lobby',
    canUpdateSettings: inRoom && room.hostId === userId && status === 'lobby',
    canSetReady: inRoom && status === 'lobby',
    canSubmitCards:
      inRoom &&
      status === 'submitting' &&
      !isJudge(room, userId) &&
      me?.connected !== false &&
      !submitted,
    canJudgePickWinner: inRoom && status === 'judging' && isJudge(room, userId),
    canNextRound: inRoom && room.hostId === userId && status === 'revealing',
  };
}

export function createCahRoom(hostId, hostName, settings = {}) {
  return {
    code: randomCode(),
    hostId,
    settings: {
      maxRounds: Number(settings.maxRounds ?? CAH_DEFAULT_MAX_ROUNDS),
      handSize: Number(settings.handSize ?? CAH_DEFAULT_HAND_SIZE),
      packs: sanitizePacks(settings.packs),
    },
    players: [{ userId: hostId, username: hostName, ready: false, connected: true, score: 0 }],
    game: null,
    stateVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    socketIds: new Set(),
    datasetVersion: 'cah-legacy-v1',
    usedBlackSourceIds: new Set(),
    usedWhiteSourceIds: new Set(),
    usedWhiteSourceIdsByUser: new Map(),
    deckRecycled: false,
  };
}

export async function startGame(room) {
  const activePlayers = room.players.filter((p) => p.connected !== false);
  if (activePlayers.length < CAH_MIN_PLAYERS) {
    throw Object.assign(new Error('Need at least 2 connected players'), { code: 'NOT_ENOUGH_PLAYERS' });
  }
  if (!room.players.every((p) => p.ready)) {
    throw Object.assign(new Error('All players must be ready'), { code: 'READY_REQUIRED' });
  }
  for (const p of room.players) p.score = 0;
  room.usedBlackSourceIds.clear();
  room.usedWhiteSourceIds.clear();
  room.usedWhiteSourceIdsByUser.clear();
  room.deckRecycled = false;
  room.game = {
    status: 'dealing',
    roundIndex: 0,
    judgeUserId: room.players[0]?.userId ?? null,
    blackCard: null,
    submissions: [],
    winnerUserId: null,
    winnerSubmissionId: null,
    revealOrder: [],
    revealComplete: false,
    roundHistory: [],
  };
  await setupRound(room);
}

export async function setupRound(room) {
  if (!room.game) throw Object.assign(new Error('Game not started'), { code: 'GAME_NOT_STARTED' });
  const game = room.game;
  game.roundIndex += 1;
  game.status = 'dealing';
  game.submissions = [];
  game.winnerUserId = null;
  game.winnerSubmissionId = null;
  game.revealOrder = [];
  game.revealComplete = false;

  const black = await drawRandomBlackCard(room);
  if (!black) throw Object.assign(new Error('No black cards available'), { code: 'DECK_EMPTY' });
  room.usedBlackSourceIds.add(black.sourceId);
  game.blackCard = { sourceId: black.sourceId, text: black.text, pick: black.pick, pack: black.pack };

  for (const p of room.players) {
    if (p.userId === game.judgeUserId) continue;
    const draw = await drawRandomWhiteCards(room, p.userId, room.settings.handSize);
    room.usedWhiteSourceIdsByUser.set(
      p.userId,
      new Set([...(room.usedWhiteSourceIdsByUser.get(p.userId) ?? new Set()), ...draw.map((c) => c.sourceId)]),
    );
    p.hand = draw.map((c) => ({ sourceId: c.sourceId, text: c.text, pack: c.pack }));
  }

  game.status = 'submitting';
}

export async function submitCards(room, userId, cardIds) {
  if (!room.game || room.game.status !== 'submitting') {
    throw Object.assign(new Error('Not accepting submissions now'), { code: 'INVALID_PHASE' });
  }
  if (room.game.judgeUserId === userId) {
    throw Object.assign(new Error('Judge cannot submit cards'), { code: 'JUDGE_CANNOT_SUBMIT' });
  }
  const pick = room.game.blackCard?.pick ?? 1;
  if (!Array.isArray(cardIds) || cardIds.length !== pick) {
    throw Object.assign(new Error(`You must submit exactly ${pick} card(s)`), { code: 'INVALID_PICK_COUNT' });
  }
  const unique = [...new Set(cardIds)];
  if (unique.length !== cardIds.length) {
    throw Object.assign(new Error('Duplicate card in submission'), { code: 'DUPLICATE_CARD_SELECTION' });
  }
  if (room.game.submissions.some((s) => s.userId === userId)) {
    throw Object.assign(new Error('Already submitted this round'), { code: 'ALREADY_SUBMITTED' });
  }
  const player = room.players.find((p) => p.userId === userId);
  if (!player) throw Object.assign(new Error('Player not found'), { code: 'PLAYER_NOT_FOUND' });
  const hand = Array.isArray(player.hand) ? player.hand : [];
  const selectedCards = cardIds.map((id) => hand.find((c) => c.sourceId === id));
  if (selectedCards.some((c) => !c)) {
    throw Object.assign(new Error('Submitted card not in hand'), { code: 'INVALID_CARD_SELECTION' });
  }
  player.hand = hand.filter((c) => !cardIds.includes(c.sourceId));
  room.usedWhiteSourceIds = new Set([...room.usedWhiteSourceIds, ...cardIds]);
  const submission = {
    submissionId: crypto.randomUUID(),
    userId,
    cards: selectedCards,
    cpu: false,
  };
  room.game.submissions.push(submission);

  const nonJudgeConnected = room.players.filter((p) => p.userId !== room.game.judgeUserId && p.connected !== false);
  if (room.game.submissions.length >= nonJudgeConnected.length) {
    if (room.players.length === 2) {
      const cpuCards = await drawRandomWhiteCards(room, '__cpu__', pick);
      if (cpuCards.length === pick) {
        room.game.submissions.push({
          submissionId: `cpu_${crypto.randomUUID()}`,
          userId: 'cpu_submission',
          cards: cpuCards.map((c) => ({ sourceId: c.sourceId, text: c.text, pack: c.pack })),
          cpu: true,
        });
      }
    }
    room.game.submissions = room.game.submissions.sort(() => Math.random() - 0.5);
    room.game.status = 'judging';
  }
}

export function judgePickWinner(room, judgeUserId, submissionId) {
  if (!room.game || room.game.status !== 'judging') {
    throw Object.assign(new Error('Not in judging phase'), { code: 'INVALID_PHASE' });
  }
  if (room.game.judgeUserId !== judgeUserId) {
    throw Object.assign(new Error('Only judge can pick winner'), { code: 'NOT_JUDGE' });
  }
  const selected = room.game.submissions.find((s) => s.submissionId === submissionId);
  if (!selected) throw Object.assign(new Error('Submission not found'), { code: 'SUBMISSION_NOT_FOUND' });
  if (selected.cpu) {
    throw Object.assign(new Error('CPU submission cannot win, pick a player submission'), {
      code: 'CPU_CANNOT_WIN',
    });
  }
  const winner = room.players.find((p) => p.userId === selected.userId);
  if (!winner) throw Object.assign(new Error('Winner player not found'), { code: 'PLAYER_NOT_FOUND' });
  winner.score += 1;
  room.game.winnerUserId = selected.userId;
  room.game.winnerSubmissionId = selected.submissionId;
  room.game.revealOrder = room.game.submissions.map((s) => s.submissionId);
  room.game.revealComplete = true;
  room.game.status = 'revealing';
  room.game.roundHistory.push({
    roundIndex: room.game.roundIndex,
    judgeUserId: room.game.judgeUserId,
    blackCard: room.game.blackCard,
    winnerUserId: selected.userId,
    submissions: room.game.submissions.map((s) => ({
      submissionId: s.submissionId,
      userId: s.userId,
      cards: s.cards,
      cpu: s.cpu,
    })),
  });
}

export async function nextRound(room) {
  if (!room.game) throw Object.assign(new Error('Game not started'), { code: 'GAME_NOT_STARTED' });
  if (room.game.status !== 'revealing') {
    throw Object.assign(new Error('Round is not ready to advance'), { code: 'INVALID_PHASE' });
  }
  if (room.game.roundIndex >= room.settings.maxRounds) {
    room.game.status = 'finished';
    return;
  }
  room.game.judgeUserId = nextJudge(room.players, room.game.judgeUserId);
  await setupRound(room);
}

export function snapshotFor(room, viewerUserId) {
  const game = room.game;
  const me = room.players.find((p) => p.userId === viewerUserId) ?? null;
  const permissions = viewerPermissions(room, viewerUserId);
  const base = {
    code: room.code,
    hostId: room.hostId,
    settings: room.settings,
    players: mapPublicPlayers(room),
    stateVersion: room.stateVersion,
    deckRecycled: room.deckRecycled,
    game: null,
    me: me ? { userId: me.userId, username: me.username, score: me.score } : null,
    permissions,
  };
  if (!game) return base;

  const canSeeSubmissions = game.status === 'judging' && game.judgeUserId === viewerUserId;
  const shouldRevealAll = game.status === 'revealing' || game.status === 'finished';
  const publicSubmissions = canSeeSubmissions || shouldRevealAll
    ? game.submissions.map((s) => ({
        submissionId: s.submissionId,
        cards: s.cards,
        ...(shouldRevealAll ? { userId: s.userId, username: room.players.find((p) => p.userId === s.userId)?.username ?? (s.cpu ? 'House Hand' : 'Unknown'), cpu: s.cpu } : {}),
      }))
    : [];

  return {
    ...base,
    game: {
      status: game.status,
      roundIndex: game.roundIndex,
      maxRounds: room.settings.maxRounds,
      judgeUserId: game.judgeUserId,
      blackCard: game.blackCard,
      hand: Array.isArray(me?.hand) ? me.hand : [],
      submissions: publicSubmissions,
      submittedCount: game.submissions.filter((s) => !s.cpu).length,
      totalExpectedSubmissions: room.players.filter((p) => p.userId !== game.judgeUserId && p.connected !== false)
        .length,
      winnerUserId: shouldRevealAll ? game.winnerUserId : null,
      winnerSubmissionId: shouldRevealAll ? game.winnerSubmissionId : null,
      roundHistory: game.roundHistory,
    },
  };
}
