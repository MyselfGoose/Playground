import test from "node:test";
import assert from "node:assert/strict";
import { createTabooRoomManager } from "./roomManager.js";

function makeSocket(id, userId, username) {
  return {
    id,
    data: { userId, username },
    join() {},
    leave() {},
    emit() {},
  };
}

function makeNs() {
  return { sockets: new Map() };
}

test("taboo room lifecycle: create join ready start and turn", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const host = makeSocket("s1", "u1", "host");
  ns.sockets.set(host.id, host);
  const room = manager.createRoom(host, "u1", "host", { roundCount: 2, roundDurationSeconds: 45 });
  assert.equal(room.players.length, 1);

  const guest = makeSocket("s2", "u2", "guest");
  ns.sockets.set(guest.id, guest);
  manager.joinRoom(room.code, guest, "u2", "guest");
  assert.equal(room.players.length, 2);

  manager.setReady(host, true);
  manager.setReady(guest, true);
  assert.ok(room.game);
  assert.equal(room.game.status, "waiting_to_start_turn");

  manager.applyAction(host, "start_turn", {});
  assert.equal(room.game.status, "turn_in_progress");
});

test("taboo guess scoring and review flow", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const a1 = makeSocket("a1", "u1", "alpha1");
  const a2 = makeSocket("a2", "u2", "alpha2");
  const b1 = makeSocket("b1", "u3", "beta1");
  ns.sockets.set(a1.id, a1);
  ns.sockets.set(a2.id, a2);
  ns.sockets.set(b1.id, b1);

  const room = manager.createRoom(a1, "u1", "alpha1", { roundCount: 1, roundDurationSeconds: 60 });
  manager.joinRoom(room.code, a2, "u2", "alpha2");
  manager.joinRoom(room.code, b1, "u3", "beta1");
  manager.changeTeam(a2, "A");
  manager.changeTeam(b1, "B");
  manager.setReady(a1, true);
  manager.setReady(a2, true);
  manager.setReady(b1, true);
  manager.applyAction(a1, "start_turn", {});

  const answer = room.game.currentCard.question;
  manager.applyAction(a2, "submit_guess", { guess: answer });
  assert.equal(room.game.scores.A >= 1, true);

  manager.applyAction(b1, "taboo_called", {});
  assert.equal(room.game.review.status, "available");
  manager.applyAction(a2, "request_review", {});
  assert.equal(room.game.review.status, "in_progress");
  manager.applyAction(a1, "review_vote", { vote: "not_fair" });
  manager.applyAction(a2, "review_vote", { vote: "not_fair" });
  manager.applyAction(b1, "review_vote", { vote: "fair" });
  assert.equal(room.game.review.status, "resolved");
});

test("taboo reconnect reattaches same user to room", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const s1 = makeSocket("s1", "u1", "p1");
  const s2 = makeSocket("s2", "u2", "p2");
  ns.sockets.set(s1.id, s1);
  ns.sockets.set(s2.id, s2);
  const room = manager.createRoom(s1, "u1", "p1", {});
  manager.joinRoom(room.code, s2, "u2", "p2");

  manager.leaveRoom(s2, { hardLeave: false });
  const s2b = makeSocket("s2b", "u2", "p2");
  ns.sockets.set(s2b.id, s2b);
  const attached = manager.attachActiveRoomForUser(s2b);
  assert.ok(attached);
  assert.equal(attached.code, room.code);
  const snap = manager.snapshotFor(s2b);
  assert.equal(snap.players.some((p) => p.id === "u2"), true);
});

test("cannot change team after game has started", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const host = makeSocket("s1", "u1", "host");
  const guest = makeSocket("s2", "u2", "guest");
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);
  const room = manager.createRoom(host, "u1", "host", {});
  manager.joinRoom(room.code, guest, "u2", "guest");
  manager.setReady(host, true);
  manager.setReady(guest, true);

  assert.throws(() => manager.changeTeam(guest, "A"), (err) => err?.code === "GAME_ALREADY_STARTED");
});

test("review resolves when disconnected players are removed from voters", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const a1 = makeSocket("a1", "u1", "alpha1");
  const a2 = makeSocket("a2", "u2", "alpha2");
  const b1 = makeSocket("b1", "u3", "beta1");
  ns.sockets.set(a1.id, a1);
  ns.sockets.set(a2.id, a2);
  ns.sockets.set(b1.id, b1);

  const room = manager.createRoom(a1, "u1", "alpha1", { roundCount: 1, roundDurationSeconds: 60 });
  manager.joinRoom(room.code, a2, "u2", "alpha2");
  manager.joinRoom(room.code, b1, "u3", "beta1");
  manager.changeTeam(a2, "A");
  manager.changeTeam(b1, "B");
  manager.setReady(a1, true);
  manager.setReady(a2, true);
  manager.setReady(b1, true);
  manager.applyAction(a1, "start_turn", {});
  manager.applyAction(b1, "taboo_called", {});
  manager.applyAction(a2, "request_review", {});

  manager.leaveRoom(a2, { hardLeave: false });
  manager.applyAction(a1, "review_vote", { vote: "fair" });
  manager.applyAction(b1, "review_vote", { vote: "fair" });
  manager.tick();
  assert.equal(room.game.review.status, "resolved");
});

test("stateVersion increases across room/game mutations", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const host = makeSocket("s1", "u1", "host");
  const guest = makeSocket("s2", "u2", "guest");
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);

  const room = manager.createRoom(host, "u1", "host", {});
  const v1 = room.stateVersion;
  manager.joinRoom(room.code, guest, "u2", "guest");
  const v2 = room.stateVersion;
  manager.setReady(host, true);
  const v3 = room.stateVersion;
  manager.setReady(guest, true);
  const v4 = room.stateVersion;
  manager.applyAction(host, "start_turn", {});
  const v5 = room.stateVersion;

  assert.ok(v2 > v1);
  assert.ok(v3 > v2);
  assert.ok(v4 > v3);
  assert.ok(v5 > v4);
});

test("game auto starts when everyone ready", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const host = makeSocket("s1", "u1", "host");
  const guest = makeSocket("s2", "u2", "guest");
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);
  const room = manager.createRoom(host, "u1", "host", {});
  manager.joinRoom(room.code, guest, "u2", "guest");

  const first = manager.setReady(host, true);
  assert.equal(first.started, false);
  const second = manager.setReady(guest, true);
  assert.equal(second.started, true);
  assert.equal(room.game?.status, "waiting_to_start_turn");
});

test("hard leave with another active socket keeps player in room", async () => {
  const ns = makeNs();
  const manager = createTabooRoomManager({ tabooNs: ns, logger: console });
  const host = makeSocket("s1", "u1", "host");
  const guestA = makeSocket("s2", "u2", "guest");
  const guestB = makeSocket("s3", "u2", "guest");
  ns.sockets.set(host.id, host);
  ns.sockets.set(guestA.id, guestA);
  ns.sockets.set(guestB.id, guestB);
  const room = manager.createRoom(host, "u1", "host", {});
  manager.joinRoom(room.code, guestA, "u2", "guest");
  manager.joinRoom(room.code, guestB, "u2", "guest");

  manager.leaveRoom(guestA, { hardLeave: true });
  assert.equal(room.players.some((p) => p.userId === "u2"), true);
  assert.equal(room.players.find((p) => p.userId === "u2")?.connected, true);
});
