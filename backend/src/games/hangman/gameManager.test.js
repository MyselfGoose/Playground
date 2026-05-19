import test from 'node:test';
import assert from 'node:assert/strict';
import { hangmanWordRepository } from '../../repositories/hangmanWordRepository.js';
import { HANGMAN_MAX_WRONG } from './constants.js';
import {
  autoAssignSetterWord,
  createHangmanRoom,
  guessLetter,
  maskWord,
  nextRound,
  normalizeHangmanWord,
  playAgainSession,
  returnSessionToLobby,
  setterSetPreview,
  setterSubmitWord,
  snapshotFor,
  startGame,
} from './gameManager.js';

test('normalizeHangmanWord rejects invalid', () => {
  assert.equal(normalizeHangmanWord(''), null);
  assert.equal(normalizeHangmanWord('Ab1'), null);
  assert.equal(normalizeHangmanWord('hello'), 'hello');
});

test('maskWord hides unguessed letters', () => {
  const guessed = new Set(['e', 'l']);
  assert.equal(maskWord('hello', guessed), '_ e l l _');
});

test('room settings always use six max wrong guesses', () => {
  const room = createHangmanRoom('h1', 'Host', { maxWrongGuesses: 12 });
  assert.equal(room.settings.maxWrongGuesses, HANGMAN_MAX_WRONG);
});

test('turn-based round win awards setter and active guesser', () => {
  const room = createHangmanRoom('h1', 'Host', {});
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  room.players[0].ready = true;
  startGame(room);
  assert.equal(room.game.phase, 'setter_pick');
  setterSetPreview(room, 'h1', 'cats');
  setterSubmitWord(room, 'h1', null);
  assert.equal(room.game.phase, 'guessing');
  assert.equal(room.game.currentTurnUserId, 'g1');
  assert.throws(() => guessLetter(room, 'h1', 'c'), (e) => e.code === 'SETTER_CANNOT_GUESS');
  guessLetter(room, 'g1', 'c');
  guessLetter(room, 'g1', 'a');
  guessLetter(room, 'g1', 't');
  guessLetter(room, 'g1', 's');
  assert.equal(room.game.phase, 'round_end');
  assert.equal(room.game.lastOutcome, 'won');
  assert.ok((room.game.scores.g1 ?? 0) >= 40);
  assert.ok((room.game.scores.h1 ?? 0) >= 15);
});

test('six wrong guesses ends round as lost', () => {
  const room = createHangmanRoom('h1', 'Host', {});
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  room.players[0].ready = true;
  startGame(room);
  setterSubmitWord(room, 'h1', 'zzzz');
  const wrongs = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (const ch of wrongs) {
    if (room.game.phase !== 'guessing') break;
    if (room.game.currentTurnUserId === 'g1') {
      guessLetter(room, 'g1', ch);
    }
  }
  assert.equal(room.game.phase, 'round_end');
  assert.equal(room.game.lastOutcome, 'lost');
  assert.equal(room.game.wrongGuessCount, HANGMAN_MAX_WRONG);
});

test('autoAssignSetterWord submits random word and starts guessing', async (t) => {
  const origRandom = hangmanWordRepository.randomWord;
  hangmanWordRepository.randomWord = async () => ({ word: 'tiger' });
  t.after(() => {
    hangmanWordRepository.randomWord = origRandom;
  });

  const room = createHangmanRoom('h1', 'Host', {});
  room.players[0].ready = true;
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  startGame(room);
  const ok = await autoAssignSetterWord(room);
  assert.equal(ok, true);
  assert.equal(room.game?.phase, 'guessing');
  assert.equal(room.game?.secretWord, 'tiger');
});

test('startGame sets setter pick deadline', () => {
  const room = createHangmanRoom('h1', 'Host', {});
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  room.players[0].ready = true;
  startGame(room);
  assert.ok(room.game.setterEndsAt > Date.now());
  const snap = snapshotFor(room, 'h1');
  assert.ok(snap.game.setterSecondsRemaining > 0);
});

function roomAtGameEnd() {
  const room = createHangmanRoom('h1', 'Host', {});
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  room.players[0].ready = true;
  startGame(room);
  setterSubmitWord(room, 'h1', 'cats');
  guessLetter(room, 'g1', 'c');
  guessLetter(room, 'g1', 'a');
  guessLetter(room, 'g1', 't');
  guessLetter(room, 'g1', 's');
  assert.equal(room.game.phase, 'round_end');
  nextRound(room, 'h1');
  setterSubmitWord(room, 'g1', 'frog');
  guessLetter(room, 'h1', 'f');
  guessLetter(room, 'h1', 'r');
  guessLetter(room, 'h1', 'o');
  guessLetter(room, 'h1', 'g');
  assert.equal(room.game.phase, 'round_end');
  nextRound(room, 'h1');
  assert.equal(room.game.phase, 'game_end');
  return room;
}

test('playAgainSession auto-readies connected players for countdown', () => {
  const room = roomAtGameEnd();
  playAgainSession(room);
  assert.equal(room.game, null);
  assert.equal(room.players.every((p) => p.ready), true);
  assert.equal(room.lobby?.lastScores, undefined);
});

test('returnSessionToLobby clears game and preserves lastScores', () => {
  const room = roomAtGameEnd();
  const scores = { ...room.game.scores };
  returnSessionToLobby(room);
  assert.equal(room.game, null);
  assert.equal(room.players.every((p) => !p.ready), true);
  assert.deepEqual(room.lobby.lastScores, scores);
});
