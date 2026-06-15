import test from "node:test";
import assert from "node:assert/strict";
import { evictSupersededPartySockets } from "./partySocketEviction.js";

test("evictSupersededPartySockets removes older sockets and emits party_session_superseded", () => {
  /** @type {Map<string, import('socket.io').Socket>} */
  const sockets = new Map();
  const emitted = /** @type {Array<[string, unknown]>} */ ([]);

  const oldSocket = {
    id: "s-old",
    data: { userId: "u1" },
    leave() {},
    emit(event, payload) {
      emitted.push([event, payload]);
    },
  };
  sockets.set("s-old", /** @type {import('socket.io').Socket} */ (oldSocket));

  const ns = {
    sockets,
  };

  const socketToCode = new Map([["s-old", "ABCD"]]);
  const userToSocketIds = new Map([["u1", new Set(["s-old", "s-new"])]]);
  const room = { socketIds: new Set(["s-old"]) };

  const evicted = evictSupersededPartySockets(/** @type {import('socket.io').Namespace} */ (ns), {
    userId: "u1",
    currentSocketId: "s-new",
    roomCode: "ABCD",
    socketToCode,
    room,
    userToSocketIds,
  });

  assert.deepEqual(evicted, ["s-old"]);
  assert.equal(socketToCode.has("s-old"), false);
  assert.equal(room.socketIds.has("s-old"), false);
  assert.equal(emitted[0]?.[0], "party_session_superseded");
});
