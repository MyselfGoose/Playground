import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from './safeNextPath.js';

test('safeNextPath allows in-app paths', () => {
  assert.equal(safeNextPath('/games'), '/games');
  assert.equal(safeNextPath('/games/npat'), '/games/npat');
});

test('safeNextPath blocks protocol-relative and external paths', () => {
  assert.equal(safeNextPath('//evil.com'), '/');
  assert.equal(safeNextPath('https://evil.com'), '/');
  assert.equal(safeNextPath(''), '/');
});
