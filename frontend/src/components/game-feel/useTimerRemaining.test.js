import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTimerSnapshot } from "./useTimerRemaining.js";

describe("computeTimerSnapshot", () => {
  it("computes seconds remaining with server offset", () => {
    const now = 1_000_000;
    const snap = computeTimerSnapshot({
      endsAt: now + 5_500,
      serverOffsetMs: 500,
      now,
      warnAtSeconds: 10,
      totalSeconds: 60,
    });
    assert.equal(snap.secondsRemaining, 5);
    assert.equal(snap.isUrgent, true);
  });

  it("announces warn only once per urgency window", () => {
    const endsAt = 20_000;
    const now = 19_400;
    const first = computeTimerSnapshot({
      endsAt,
      now,
      warnAtSeconds: 10,
      alreadyWarned: false,
    });
    assert.equal(first.warnAnnounced, true);

    const second = computeTimerSnapshot({
      endsAt,
      now,
      warnAtSeconds: 10,
      alreadyWarned: true,
    });
    assert.equal(second.warnAnnounced, false);
    assert.equal(second.isUrgent, true);
  });

  it("returns zero when past end", () => {
    const snap = computeTimerSnapshot({
      endsAt: 1000,
      now: 5000,
    });
    assert.equal(snap.secondsRemaining, 0);
    assert.equal(snap.percent, 0);
    assert.equal(snap.isUrgent, false);
  });
});
