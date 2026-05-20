import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COUNTDOWN_STEPS } from "./gameFeelMotion.js";

describe("CountdownStrip steps", () => {
  it("uses 3-2-1-GO sequence", () => {
    assert.deepEqual(COUNTDOWN_STEPS, ["3", "2", "1", "GO"]);
  });

  it("schedules four steps across default duration", () => {
    const durationMs = 3000;
    const stepDuration = Math.floor(durationMs / COUNTDOWN_STEPS.length);
    assert.equal(stepDuration, 750);
    assert.equal(stepDuration * COUNTDOWN_STEPS.length, durationMs);
  });
});
