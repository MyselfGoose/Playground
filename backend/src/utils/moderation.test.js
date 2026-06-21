import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isModerationBlocked } from '../utils/moderation.js';

test('isModerationBlocked returns false for none or missing moderation', () => {
  assert.equal(isModerationBlocked(null), false);
  assert.equal(isModerationBlocked({}), false);
  assert.equal(isModerationBlocked({ moderation: { status: 'none' } }), false);
});

test('isModerationBlocked returns true for banned', () => {
  assert.equal(isModerationBlocked({ moderation: { status: 'banned' } }), true);
});

test('isModerationBlocked respects suspended expiry', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(isModerationBlocked({ moderation: { status: 'suspended', expiresAt: future } }), true);
  assert.equal(isModerationBlocked({ moderation: { status: 'suspended', expiresAt: past } }), false);
});

test('isModerationBlocked treats suspended without expiry as blocked', () => {
  assert.equal(isModerationBlocked({ moderation: { status: 'suspended', expiresAt: null } }), true);
});
