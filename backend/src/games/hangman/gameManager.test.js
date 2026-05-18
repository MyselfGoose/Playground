import test from 'node:test';
import assert from 'node:assert/strict';
import { HANGMAN_MAX_WRONG } from './constants.js';
import {
  createHangmanRoom,
  guessLetter,
  maskWord,
  normalizeHangmanWord,
  setterSetPreview,
  setterSubmitWord,
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
