import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresenceRegistry } from './presenceRegistry.js';

test('presence registry keeps user online until last tab disconnects', () => {
  const presence = createPresenceRegistry();
  const first = presence.addSocket('u1', 's1');
  assert.equal(first, true);
  const second = presence.addSocket('u1', 's2');
  assert.equal(second, false);
  assert.equal(presence.isOnline('u1'), true);

  const partial = presence.removeSocket('s1');
  assert.equal(partial?.wentOffline, false);
  assert.equal(presence.isOnline('u1'), true);

  const last = presence.removeSocket('s2');
  assert.equal(last?.wentOffline, true);
  assert.equal(presence.isOnline('u1'), false);
  assert.ok(presence.getLastSeenAt('u1'));
});

test('filterOnline returns only online friend ids', () => {
  const presence = createPresenceRegistry();
  presence.addSocket('a', 's-a');
  const online = presence.filterOnline(['a', 'b', 'c']);
  assert.deepEqual(online, ['a']);
});
