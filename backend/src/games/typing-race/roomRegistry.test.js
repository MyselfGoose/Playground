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

/** @type {Map<string, import('socket.io').Socket>} */
const mockSocketMap = new Map();

const mockNs = {
  to: () => ({ emit: () => {} }),
  sockets: mockSocketMap,
};

/**
 * @param {string} id
 * @param {string} [userId]
 */
function mockSocket(id, userId = "user-default") {
  const sock = {
    id,
    data: { userId },
    /** @type {string[]} */
    joined: [],
    /** @type {unknown[]} */
    emitted: [],
    /** @param {string} room */
    join(room) {
      this.joined.push(room);
    },
    leave() {},
    /** @param {string} event @param {unknown} payload */
    emit(event, payload) {
      this.emitted.push([event, payload]);
    },
  };
  mockSocketMap.set(id, /** @type {import('socket.io').Socket} */ (sock));
  return sock;
}

function freshRegistry() {
  mockSocketMap.clear();
  return createTypingRaceRegistry({ typingNs: mockNs, logger: mockLogger });
}

test("joinRoom with same socket already in that room keeps registry entry and one player", () => {
  const registry = freshRegistry();
  const socket = mockSocket("sock-same-room", "user-1");
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
  const registry = freshRegistry();
  const s1 = mockSocket("sock-1", "u1");
  const s2 = mockSocket("sock-2", "u2");
  const { code: codeA } = registry.createRoom(s1, "u1", "A");
  const { code: codeB } = registry.createRoom(s2, "u2", "B");
  assert.notEqual(codeA, codeB);

  registry.joinRoom(codeB, s1, "u1", "A");
  assert.equal(registry.socketToRoom.get(s1.id), codeB);
  assert.equal(registry.rooms.get(codeA), undefined, "previous room removed when last player left");
  assert.ok(registry.rooms.get(codeB).players.get("u1"));
});

test("transport disconnect then rejoin with new socket keeps room (no ROOM_NOT_FOUND)", () => {
  const registry = freshRegistry();
  const s1 = mockSocket("sock-a", "u1");
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

  const s2 = mockSocket("sock-b", "u1");
  registry.joinRoom(code, s2, "u1", "Alice");
  assert.equal(registry.socketToRoom.get(s2.id), code);
  assert.equal(registry.rooms.get(code).players.get("u1")?.connected, true);
});

test("kickPlayer removes guest from lobby and emits typing_kicked", () => {
  const registry = freshRegistry();
  const host = mockSocket("sock-host", "host-1");
  const guest = mockSocket("sock-guest", "guest-1");
  const { code } = registry.createRoom(host, "host-1", "Host");
  registry.joinRoom(code, guest, "guest-1", "Guest");

  assert.equal(registry.rooms.get(code)?.players.size, 2);

  registry.kickPlayer(host, "guest-1");

  assert.equal(registry.rooms.get(code)?.players.size, 1);
  assert.equal(registry.rooms.get(code)?.players.has("guest-1"), false);
  assert.equal(registry.socketToRoom.get(guest.id), undefined);
  assert.ok(
    guest.emitted.some(([e]) => e === "typing_kicked"),
    "kicked socket receives typing_kicked",
  );
});

test("kickPlayer rejects non-host", () => {
  const registry = freshRegistry();
  const host = mockSocket("sock-host", "host-1");
  const guest = mockSocket("sock-guest", "guest-1");
  const { code } = registry.createRoom(host, "host-1", "Host");
  registry.joinRoom(code, guest, "guest-1", "Guest");

  assert.throws(
    () => registry.kickPlayer(guest, "host-1"),
    (e) => /** @type {any} */ (e).code === "FORBIDDEN",
  );
});

test("resetLobby rejects non-host", () => {
  const registry = freshRegistry();
  const host = mockSocket("sock-host", "host-1");
  const guest = mockSocket("sock-guest", "guest-1");
  const { code } = registry.createRoom(host, "host-1", "Host");
  const room = registry.joinRoom(code, guest, "guest-1", "Guest");
  room.phase = "finished";

  assert.throws(
    () => room.resetLobby("guest-1"),
    (e) => /** @type {any} */ (e).code === "FORBIDDEN",
  );
});
