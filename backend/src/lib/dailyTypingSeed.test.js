import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTypingSeedFromDate, utcDateString } from './dailyTypingSeed.js';

describe('dailyTypingSeed', () => {
  it('utcDateString returns YYYY-MM-DD', () => {
    assert.equal(utcDateString('2026-05-19'), '2026-05-19');
  });

  it('dailyTypingSeedFromDate is stable for same date', () => {
    const a = dailyTypingSeedFromDate('2026-05-19');
    const b = dailyTypingSeedFromDate('2026-05-19');
    assert.equal(a, b);
    assert.ok(a > 0);
  });

  it('dailyTypingSeedFromDate differs across dates', () => {
    const a = dailyTypingSeedFromDate('2026-05-19');
    const b = dailyTypingSeedFromDate('2026-05-20');
    assert.notEqual(a, b);
  });
});
