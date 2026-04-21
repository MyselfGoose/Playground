import assert from "node:assert/strict";
import test from "node:test";
import {
  applyKeyEvent,
  completeTimed,
  createInitialState,
  getDisplayIndex,
} from "./typing-engine.js";

function key(key, rest = {}) {
  return { key, ...rest };
}

test("correct line completes words mode", () => {
  let s = createInitialState({
    mode: "words",
    seed: 1,
    passage: "a b",
    wordTarget: 2,
  });
  assert.equal(s.status, "idle");
  s = applyKeyEvent(s, key("a"), 1000);
  assert.equal(s.status, "running");
  s = applyKeyEvent(s, key(" "), 1001);
  s = applyKeyEvent(s, key("b"), 1002);
  assert.equal(s.status, "completed");
  assert.equal(s.cursor, 3);
});

test("error stack blocks advance", () => {
  let s = createInitialState({
    mode: "words",
    seed: 1,
    passage: "ab",
    wordTarget: 1,
  });
  s = applyKeyEvent(s, key("x"), 1);
  assert.equal(s.cursor, 0);
  assert.ok(s.errorStack.length > 0);
  s = applyKeyEvent(s, key("Backspace"), 2);
  assert.equal(s.errorStack, "");
  s = applyKeyEvent(s, key("a"), 3);
  s = applyKeyEvent(s, key("b"), 4);
  assert.equal(s.status, "completed");
});

test("backspace undoes correct", () => {
  let s = createInitialState({
    mode: "words",
    seed: 1,
    passage: "hi",
    wordTarget: 1,
  });
  s = applyKeyEvent(s, key("h"), 1);
  assert.equal(s.stats.correctChars, 1);
  s = applyKeyEvent(s, key("Backspace"), 2);
  assert.equal(s.cursor, 0);
  assert.equal(s.stats.correctChars, 0);
});

test("time mode complete via completeTimed", () => {
  let s = createInitialState({
    mode: "time",
    seed: 1,
    passage: "hello world",
    timeLimitSec: 30,
  });
  s = applyKeyEvent(s, key("h"), 10000);
  s = completeTimed(s, 10000 + 30_000);
  assert.equal(s.status, "completed");
});

test("display index with stack", () => {
  let s = createInitialState({
    mode: "words",
    seed: 1,
    passage: "test",
    wordTarget: 1,
  });
  s = applyKeyEvent(s, key("x"), 1);
  assert.equal(getDisplayIndex(s), 1);
});

test("burst typing 150 wpm simulation", () => {
  const passage = "the quick brown fox jumps";
  let s = createInitialState({
    mode: "words",
    seed: 1,
    passage,
    wordTarget: 5,
  });
  let t = 1;
  for (const ch of passage) {
    s = applyKeyEvent(s, key(ch), t);
    t += 2;
  }
  assert.equal(s.status, "completed");
  assert.equal(s.stats.correctChars, passage.length);
});
