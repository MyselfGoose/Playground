import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHangmanRoom,
  guessLetter,
  maskWord,
  normalizeHangmanWord,
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

test('full round win awards setter and guessers', () => {
  const room = createHangmanRoom('h1', 'Host', {});
  room.players.push({ userId: 'g1', username: 'Guest', ready: true, connected: true });
  room.players[0].ready = true;
  startGame(room);
  assert.equal(room.game.phase, 'setter_pick');
  setterSubmitWord(room, 'h1', 'cats');
  assert.equal(room.game.phase, 'guessing');
  guessLetter(room, 'g1', 'c');
  guessLetter(room, 'g1', 'a');
  guessLetter(room, 'g1', 't');
  guessLetter(room, 'g1', 's');
  assert.equal(room.game.phase, 'round_end');
  assert.equal(room.game.lastOutcome, 'won');
  assert.ok((room.game.scores.g1 ?? 0) >= 40);
  assert.ok((room.game.scores.h1 ?? 0) >= 15);
});
