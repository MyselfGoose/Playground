import test from 'node:test';
import assert from 'node:assert/strict';
import { usernameFieldSchema } from '../validation/auth.schemas.js';

test('usernameFieldSchema accepts valid usernames', () => {
  const r = usernameFieldSchema.safeParse('cool_player');
  assert.equal(r.success, true);
});

test('usernameFieldSchema rejects invalid usernames', () => {
  const r = usernameFieldSchema.safeParse('ab');
  assert.equal(r.success, false);
});
