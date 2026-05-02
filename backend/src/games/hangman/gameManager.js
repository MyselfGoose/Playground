import crypto from 'node:crypto';
import {
  HANGMAN_DEFAULT_MAX_WRONG,
  HANGMAN_MIN_PLAYERS,
  HANGMAN_POINTS_EFFICIENCY_POOL,
  HANGMAN_POINTS_LETTER_FIRST,
  HANGMAN_POINTS_SETTER_COMPLETE,
  HANGMAN_WORD_MAX,
  HANGMAN_WORD_MIN,
} from './constants.js';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function sanitizeDatasetVersion(v) {
  const s = String(v ?? '').trim();
  return s || 'hangman-en-v1';
}

export function activePlayers(room) {
  return room.players.filter((p) => p.connected !== false);
}

function currentSetterId(game) {
  if (!game?.setterOrder?.length) return null;
  return game.setterOrder[game.setterCursor] ?? null;
}

function emptyScores(setterOrder) {
  /** @type {Record<string, number>} */
  const o = {};
  for (const id of setterOrder) o[id] = 0;
  return o;
}

export function normalizeHangmanWord(raw) {
  const w = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC');
  if (!/^[a-z]+$/.test(w)) return null;
  if (w.length < HANGMAN_WORD_MIN || w.length > HANGMAN_WORD_MAX) return null;
  return w;
}

export function maskWord(secret, guessedSet) {
  return [...secret].map((ch) => (guessedSet.has(ch) ? ch : '_')).join(' ');
}

export function createHangmanRoom(hostId, hostName, settings = {}) {
  return {
    code: randomCode(),
    hostId,
    settings: {
      maxWrongGuesses: Math.min(
        12,
        Math.max(4, Number(settings.maxWrongGuesses ?? HANGMAN_DEFAULT_MAX_WRONG) || HANGMAN_DEFAULT_MAX_WRONG),
      ),
      minWordLength: Math.min(
        HANGMAN_WORD_MAX,
        Math.max(HANGMAN_WORD_MIN, Number(settings.minWordLength ?? HANGMAN_WORD_MIN) || HANGMAN_WORD_MIN),
      ),
      maxWordLength: Math.min(
        HANGMAN_WORD_MAX,
        Math.max(HANGMAN_WORD_MIN, Number(settings.maxWordLength ?? HANGMAN_WORD_MAX) || HANGMAN_WORD_MAX),
      ),
      datasetVersion: sanitizeDatasetVersion(settings.datasetVersion),
    },
    players: [{ userId: hostId, username: hostName, ready: false, connected: true }],
    game: null,
    stateVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    socketIds: new Set(),
  };
}

export function startGame(room) {
  const active = activePlayers(room);
  if (active.length < HANGMAN_MIN_PLAYERS) {
    throw Object.assign(new Error('Need at least 2 players'), { code: 'MIN_PLAYERS_REQUIRED' });
  }
  if (!active.every((p) => p.ready)) {
    throw Object.assign(new Error('All players must be ready'), { code: 'READY_REQUIRED' });
  }

  const setterOrder = active.map((p) => p.userId);
  const scores = emptyScores(setterOrder);

  room.game = {
    phase: 'setter_pick',
    roundNumber: 1,
    setterOrder,
    setterCursor: 0,
    sessionId: crypto.randomUUID(),
    maxWrongGuesses: room.settings.maxWrongGuesses,
    minWordLength: room.settings.minWordLength,
    maxWordLength: room.settings.maxWordLength,
    datasetVersion: room.settings.datasetVersion,
    secretWord: null,
    guessedLetters: [],
    wrongLetters: [],
    wrongGuessCount: 0,
    scores,
    lettersFirstThisRound: {},
    lastOutcome: null,
    revealedWord: null,
    abortedReason: null,
  };
}

export function setterSubmitWord(room, userId, rawWord) {
  const game = room.game;
  if (!game || game.phase !== 'setter_pick') {
    throw Object.assign(new Error('Cannot submit word now'), { code: 'INVALID_PHASE' });
  }
  const setter = currentSetterId(game);
  if (setter !== userId) {
    throw Object.assign(new Error('Only the word setter can submit'), { code: 'NOT_SETTER' });
  }
  const word = normalizeHangmanWord(rawWord);
  if (!word) {
    throw Object.assign(new Error('Invalid word'), { code: 'INVALID_WORD' });
  }
  if (word.length < game.minWordLength || word.length > game.maxWordLength) {
    throw Object.assign(new Error('Word length out of range'), { code: 'WORD_LENGTH' });
  }

  game.secretWord = word;
  game.guessedLetters = [];
  game.wrongLetters = [];
  game.wrongGuessCount = 0;
  game.lettersFirstThisRound = {};
  game.lastOutcome = null;
  game.revealedWord = null;
  game.abortedReason = null;
  game.phase = 'guessing';
}

/** Apply server-chosen random word (already normalized). */
export function setterApplyServerWord(room, userId, word) {
  const game = room.game;
  if (!game || game.phase !== 'setter_pick') {
    throw Object.assign(new Error('Cannot set random word now'), { code: 'INVALID_PHASE' });
  }
  if (currentSetterId(game) !== userId) {
    throw Object.assign(new Error('Only the word setter can pick'), { code: 'NOT_SETTER' });
  }
  if (!word || !normalizeHangmanWord(word)) {
    throw Object.assign(new Error('No word available'), { code: 'WORD_BANK_EMPTY' });
  }
  setterSubmitWord(room, userId, word);
}

export function guessLetter(room, userId, rawLetter) {
  const game = room.game;
  if (!game || game.phase !== 'guessing') {
    throw Object.assign(new Error('Not accepting guesses'), { code: 'INVALID_PHASE' });
  }
  const setter = currentSetterId(game);
  if (setter === userId) {
    throw Object.assign(new Error('Setter cannot guess'), { code: 'SETTER_CANNOT_GUESS' });
  }
  const ch = String(rawLetter ?? '')
    .trim()
    .toLowerCase()[0];
  if (!ch || !/[a-z]/.test(ch)) {
    throw Object.assign(new Error('Invalid letter'), { code: 'INVALID_LETTER' });
  }

  const secret = game.secretWord;
  if (!secret) throw Object.assign(new Error('Missing secret'), { code: 'INTERNAL_ERROR' });

  const guessed = new Set(game.guessedLetters);
  const wrongSet = new Set(game.wrongLetters);

  if (guessed.has(ch) || wrongSet.has(ch)) {
    throw Object.assign(new Error('Letter already guessed'), { code: 'ALREADY_GUESSED' });
  }

  if (secret.includes(ch)) {
    game.guessedLetters = [...game.guessedLetters, ch].sort();
    guessed.add(ch);
    if (!game.lettersFirstThisRound[userId]) game.lettersFirstThisRound[userId] = 0;
    game.lettersFirstThisRound[userId] += 1;
    game.scores[userId] = (game.scores[userId] ?? 0) + HANGMAN_POINTS_LETTER_FIRST;

    if (allLettersRevealed(secret, guessed)) {
      game.scores[setter] = (game.scores[setter] ?? 0) + HANGMAN_POINTS_SETTER_COMPLETE;
      finishRound(room, 'won');
    }
  } else {
    game.wrongLetters = [...game.wrongLetters, ch].sort();
    game.wrongGuessCount += 1;
    if (game.wrongGuessCount >= game.maxWrongGuesses) {
      finishRound(room, 'lost');
    }
  }
}

function allLettersRevealed(secret, guessedSet) {
  const uniq = new Set(secret.split(''));
  for (const c of uniq) {
    if (!guessedSet.has(c)) return false;
  }
  return true;
}

function applyEfficiencyBonus(game) {
  if (game.lastOutcome !== 'won') return;
  const ratio = game.wrongGuessCount / Math.max(1, game.maxWrongGuesses);
  if (ratio > 0.4) return;
  const setter = currentSetterId(game);
  const recipients = game.setterOrder.filter(
    (id) => id !== setter && (game.lettersFirstThisRound[id] ?? 0) > 0,
  );
  if (!recipients.length) return;
  const each = Math.round((HANGMAN_POINTS_EFFICIENCY_POOL / recipients.length) * 100) / 100;
  for (const id of recipients) {
    game.scores[id] = Math.round(((game.scores[id] ?? 0) + each) * 100) / 100;
  }
}

function finishRound(room, outcome) {
  const game = room.game;
  if (!game) return;
  game.lastOutcome = outcome;
  game.revealedWord = game.secretWord;
  applyEfficiencyBonus(game);
  game.phase = 'round_end';
}

/** Called when setter leaves mid-round — expose partial progress. */
export function abortRoundSetterLeft(room, reason = 'setter_disconnected') {
  const game = room.game;
  if (!game || !['setter_pick', 'guessing'].includes(game.phase)) return;
  game.lastOutcome = 'aborted';
  game.abortedReason = reason;
  game.revealedWord = game.secretWord;
  game.phase = 'round_end';
}

export function nextRound(room, hostUserId) {
  if (room.hostId !== hostUserId) {
    throw Object.assign(new Error('Only host can advance'), { code: 'NOT_HOST' });
  }
  const game = room.game;
  if (!game || game.phase !== 'round_end') {
    throw Object.assign(new Error('Round not finished'), { code: 'INVALID_PHASE' });
  }

  game.setterCursor += 1;
  if (game.setterCursor >= game.setterOrder.length) {
    game.phase = 'game_end';
    game.secretWord = null;
    return;
  }

  game.roundNumber += 1;
  game.phase = 'setter_pick';
  game.secretWord = null;
  game.guessedLetters = [];
  game.wrongLetters = [];
  game.wrongGuessCount = 0;
  game.lettersFirstThisRound = {};
  game.lastOutcome = null;
  game.revealedWord = null;
  game.abortedReason = null;
}

export function reconcileRoomAfterMembershipChange(room) {
  const game = room.game;
  if (!game || ['lobby', 'game_end'].includes(game.phase)) return;

  const active = activePlayers(room);
  const activeIds = new Set(active.map((p) => p.userId));

  if (active.length < HANGMAN_MIN_PLAYERS) {
    room.game = null;
    return;
  }

  game.setterOrder = game.setterOrder.filter((id) => activeIds.has(id));
  if (!game.setterOrder.length) {
    room.game = null;
    return;
  }

  while (game.setterCursor >= game.setterOrder.length) {
    game.setterCursor = Math.max(0, game.setterOrder.length - 1);
  }

  const setter = currentSetterId(game);
  if (setter && !activeIds.has(setter)) {
    abortRoundSetterLeft(room, 'setter_left');
  }

  for (const uid of Object.keys(game.scores)) {
    if (!activeIds.has(uid)) delete game.scores[uid];
  }
  for (const p of active) {
    if (game.scores[p.userId] == null) game.scores[p.userId] = 0;
  }
}

export function viewerPermissions(room, viewerUserId) {
  const game = room.game;
  const inRoom = room.players.some((p) => p.userId === viewerUserId);
  const inLobby = !game;
  const status = game?.phase ?? 'lobby';
  const setterId = game ? currentSetterId(game) : null;
  const active = activePlayers(room);
  const canStartFromLobby = inRoom && inLobby && room.hostId === viewerUserId && active.length >= HANGMAN_MIN_PLAYERS && active.every((p) => p.ready);
  return {
    canJoin: true,
    canSetReady: inRoom && inLobby,
    canUpdateSettings: inRoom && room.hostId === viewerUserId && inLobby,
    canStart: canStartFromLobby,
    canSubmitWord: inRoom && status === 'setter_pick' && setterId === viewerUserId,
    canRequestRandomWord: inRoom && status === 'setter_pick' && setterId === viewerUserId,
    canGuess: inRoom && status === 'guessing' && setterId !== viewerUserId,
    canNextRound: inRoom && room.hostId === viewerUserId && status === 'round_end',
  };
}

export function snapshotFor(room, viewerUserId) {
  const base = {
    code: room.code,
    hostId: room.hostId,
    settings: room.settings,
    players: room.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      ready: p.ready,
      connected: p.connected,
    })),
    stateVersion: room.stateVersion,
    me: room.players.find((p) => p.userId === viewerUserId) ?? null,
    permissions: viewerPermissions(room, viewerUserId),
    game: null,
  };

  const game = room.game;
  if (!game) return base;

  const setterId = currentSetterId(game);
  const guessedSet = new Set(game.guessedLetters);
  const isSetter = viewerUserId === setterId;

  let masked = null;
  if (game.secretWord && ['guessing', 'round_end', 'game_end'].includes(game.phase)) {
    masked = maskWord(game.secretWord, guessedSet);
  }

  base.game = {
    phase: game.phase,
    roundNumber: game.roundNumber,
    setterUserId: setterId,
    setterOrder: [...game.setterOrder],
    maxWrongGuesses: game.maxWrongGuesses,
    wrongGuessCount: game.wrongGuessCount,
    guessedLetters: [...game.guessedLetters],
    wrongLetters: [...game.wrongLetters],
    maskedWord: masked,
    scores: { ...game.scores },
    lastOutcome: game.lastOutcome,
    revealedWord: ['round_end', 'game_end'].includes(game.phase) ? game.revealedWord : null,
    abortedReason: game.abortedReason,
    secretPreviewForSetter: game.phase === 'guessing' && isSetter ? game.secretWord : null,
    hangmanStage: Math.min(game.wrongGuessCount, game.maxWrongGuesses),
  };

  return base;
}
