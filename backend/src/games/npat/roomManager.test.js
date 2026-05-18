import test from 'node:test';
import assert from 'node:assert/strict';
import { npatMissingEngineJoinError } from './roomManager.js';

test('npatMissingEngineJoinError returns ROOM_NOT_FOUND for unknown code', () => {
  const map = new Map();
  const result = npatMissingEngineJoinError('123456', map);
  assert.equal(result.code, 'ROOM_NOT_FOUND');
});

test('npatMissingEngineJoinError returns ROOM_EXPIRED for recently deleted code', () => {
  const map = new Map([['123456', Date.now()]]);
  const result = npatMissingEngineJoinError('123456', map);
  assert.equal(result.code, 'ROOM_EXPIRED');
});

test('npatMissingEngineJoinError prunes stale expired entries', () => {
  const map = new Map([['123456', Date.now() - 6 * 60 * 1000]]);
  const result = npatMissingEngineJoinError('123456', map);
  assert.equal(result.code, 'ROOM_NOT_FOUND');
  assert.equal(map.has('123456'), false);
});
