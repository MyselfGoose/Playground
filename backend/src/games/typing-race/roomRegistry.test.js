import assert from "node:assert/strict";
import test from "node:test";
import { createTypingRaceRegistry } from "./roomRegistry.js";

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
 * @param {string} id
 */
function mockSocket(id) {
  return {
    id,
    /** @type {string[]} */
    joined: [],
    /** @param {string} room */
    join(room) {
      this.joined.push(room);
    },
    leave() {},
  };
}

test("joinRoom with same socket already in that room keeps registry entry and one player", () => {
  const registry = createTypingRaceRegistry({ typingNs: mockNs, logger: mockLogger });
  const socket = mockSocket("sock-same-room");
  const { code } = registry.createRoom(socket, "user-1", "Alice");

  assert.ok(registry.rooms.get(code), "room exists after create");
  assert.equal(registry.rooms.get(code).players.size, 1);
  assert.equal(registry.socketToRoom.get(socket.id), code);

  registry.joinRoom(code, socket, "user-1", "Alice");

  assert.ok(registry.rooms.get(code), "room must not be deleted when re-joining same room");
  assert.equal(registry.rooms.get(code).players.size, 1);
  assert.equal(registry.socketToRoom.get(socket.id), code);
});

test("joinRoom with socket from another room moves player without ROOM_NOT_FOUND", () => {
  const registry = createTypingRaceRegistry({ typingNs: mockNs, logger: mockLogger });
  const s1 = mockSocket("sock-1");
  const s2 = mockSocket("sock-2");
  const { code: codeA } = registry.createRoom(s1, "u1", "A");
  const { code: codeB } = registry.createRoom(s2, "u2", "B");
  assert.notEqual(codeA, codeB);

  registry.joinRoom(codeB, s1, "u1", "A");
  assert.equal(registry.socketToRoom.get(s1.id), codeB);
  assert.equal(registry.rooms.get(codeA), undefined, "previous room removed when last player left");
  assert.ok(registry.rooms.get(codeB).players.get("u1"));
});

test("transport disconnect then rejoin with new socket keeps room (no ROOM_NOT_FOUND)", () => {
  const registry = createTypingRaceRegistry({ typingNs: mockNs, logger: mockLogger });
  const s1 = mockSocket("sock-a");
  const { code } = registry.createRoom(s1, "u1", "Alice");
  assert.ok(registry.rooms.get(code));

  registry.onSocketDisconnect(s1);
  assert.ok(
    registry.rooms.get(code),
    "lobby room survives soft disconnect (host still listed, disconnected)",
  );
  const p = registry.rooms.get(code).players.get("u1");
  assert.ok(p);
  assert.equal(p.connected, false);
  assert.equal(registry.socketToRoom.get(s1.id), undefined, "old socket unmapped");

  const s2 = mockSocket("sock-b");
  registry.joinRoom(code, s2, "u1", "Alice");
  assert.equal(registry.socketToRoom.get(s2.id), code);
  assert.equal(registry.rooms.get(code).players.get("u1")?.connected, true);
});
