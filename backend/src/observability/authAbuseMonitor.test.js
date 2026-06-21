import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordLoginFailure,
  recordRateLimitHit,
  getAuthAbuseSnapshot,
  clearAuthAbuseMonitorForTests,
} from '../observability/authAbuseMonitor.js';

describe('authAbuseMonitor', () => {
  beforeEach(() => {
    clearAuthAbuseMonitorForTests();
  });

  it('tracks login failures and rate limits per IP', () => {
    recordLoginFailure('1.2.3.4');
    recordLoginFailure('1.2.3.4');
    recordRateLimitHit('1.2.3.4');
    const snap = getAuthAbuseSnapshot({ limit: 10 });
    assert.equal(snap.entries.length, 1);
    assert.equal(snap.entries[0].ip, '1.2.3.4');
    assert.equal(snap.entries[0].loginFailures, 2);
    assert.equal(snap.entries[0].rateLimitHits, 1);
  });
});
