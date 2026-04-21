import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePassage,
  generateWordCountPassage,
  normalizePassage,
} from "./text-gen.js";

test("normalizePassage", () => {
  assert.equal(normalizePassage("  a  b  "), "a b");
});

test("word passage deterministic", () => {
  const a = generateWordCountPassage(10, 4242);
  const b = generateWordCountPassage(10, 4242);
  assert.equal(a, b);
  assert.equal(a.split(" ").length, 10);
});

test("no immediate repeat usually", () => {
  const p = generateWordCountPassage(50, 9999);
  const words = p.split(" ");
  let repeats = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) repeats++;
  }
  assert.ok(repeats < words.length * 0.15);
});

test("generatePassage time mode length", () => {
  const p = generatePassage({ mode: "time", seed: 1, timeLimitSec: 60 });
  assert.ok(p.length > 2000);
});
