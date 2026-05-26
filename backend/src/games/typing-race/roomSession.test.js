import assert from "node:assert/strict";
import test from "node:test";
import { TypingRaceRoom } from "./roomSession.js";

/** @type {import('pino').Logger} */
const mockLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => mockLogger,
};

const mockNs = {
  to: () => ({ emit: () => {} }),
};

/**
 * @param {string} passage
 */
function racingRoom(passage = "abcde") {
  const room = new TypingRaceRoom({
    roomCode: "123456",
    typingNs: /** @type {import('socket.io').Namespace} */ (mockNs),
    logger: mockLogger,
  });
  const socket = { id: "sock-1", join: () => {} };
  room.addPlayer("u1", "Alice", /** @type {import('socket.io').Socket} */ (socket));
  room.hostUserId = "u1";
  room.raceConfig = { passage, seed: 1, version: 1 };
  room.phase = "racing";
  room.raceStartAtMs = Date.now();
  return room;
}

test("finishPlayer accepts max(cursor, cursorDisplay) at passage end", () => {
  const room = racingRoom("hello");
  const p = room.players.get("u1");
  assert.ok(p);
  p.cursor = 2;
  p.cursorDisplay = 5;

  room.finishPlayer("u1");

  assert.notEqual(p.finishedAtMs, null);
  assert.equal(p.rank, 1);
});

test("finishPlayer rejects when effective cursor before passage end", () => {
  const room = racingRoom("hello");
  const p = room.players.get("u1");
  assert.ok(p);
  p.cursor = 2;
  p.cursorDisplay = 3;

  assert.throws(
    () => room.finishPlayer("u1"),
    (err) => /** @type {any} */ (err).code === "NOT_DONE",
  );
  assert.equal(p.finishedAtMs, null);
});

test("_finishRace marks unfinished players with finishedAtMs for DNF display", () => {
  const room = racingRoom("hi");
  const p = room.players.get("u1");
  assert.ok(p);
  assert.equal(p.finishedAtMs, null);

  room._finishRace("timeout");

  assert.equal(room.phase, "finished");
  assert.notEqual(p.finishedAtMs, null);
  assert.equal(p.rank, null);
});
