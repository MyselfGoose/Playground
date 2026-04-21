import assert from "node:assert/strict";
import test from "node:test";
import {
  computeConsistency,
  computeTypingMetrics,
} from "./metrics.js";

test("metrics zero elapsed", () => {
  const m = computeTypingMetrics(
    { correctChars: 10, incorrectChars: 2, extraChars: 1 },
    0,
  );
  assert.equal(m.wpm, 0);
  assert.equal(m.rawWpm, 0);
});

test("metrics net and raw", () => {
  /** 60 correct = 12 “words” in 60s → 12 wpm net */
  const m = computeTypingMetrics(
    { correctChars: 60, incorrectChars: 10, extraChars: 5 },
    60,
  );
  assert.equal(m.wpm, 12);
  assert.ok(Math.abs(m.rawWpm - 15) < 0.001);
  assert.ok(m.accuracy < 100);
});

test("consistency null for short", () => {
  assert.equal(computeConsistency([1, 2]), null);
});
