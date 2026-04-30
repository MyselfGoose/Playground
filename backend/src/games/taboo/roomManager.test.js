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
  manager.startGame(host);
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
  manager.startGame(a1);
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
