import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, isTooCloseToTruth } from './normalizeAnswer.js';

test('normalizeAnswer strips punctuation and collapses whitespace', () => {
  assert.equal(normalizeAnswer('  Hello World! '), 'hello world');
  assert.equal(normalizeAnswer('JOUSTING'), 'jousting');
  assert.equal(normalizeAnswer('one.two,three!'), 'onetwothree');
  assert.equal(normalizeAnswer('The   quick   brown fox'), 'the quick brown fox');
});

test('normalizeAnswer handles empty input', () => {
  assert.equal(normalizeAnswer('  '), '');
  assert.equal(normalizeAnswer(null), '');
  assert.equal(normalizeAnswer(undefined), '');
});

test('isTooCloseToTruth blocks exact normalized matches', () => {
  assert.equal(isTooCloseToTruth('jousting', 'Jousting'), true);
  assert.equal(isTooCloseToTruth('JOUSTING!', 'jousting'), true);
  assert.equal(isTooCloseToTruth('swordfighting', 'jousting'), false);
  assert.equal(isTooCloseToTruth('', 'jousting'), false);
});
