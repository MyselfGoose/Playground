import test from 'node:test';
import assert from 'node:assert/strict';
import { createHangmanRoomManager } from './roomManager.js';

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

test('soft disconnect does not immediately drop game or rotate host', async () => {
  const ns = makeNs();
  const manager = createHangmanRoomManager({ hangmanNs: ns, logger: console });
  const host = makeSocket('s1', 'u1', 'host');
  const guest = makeSocket('s2', 'u2', 'guest');
  ns.sockets.set(host.id, host);
  ns.sockets.set(guest.id, guest);

  const room = await manager.createRoom(host, {});
  await manager.joinRoom(guest, room.code);
  manager.setReady(host, true);
  manager.setReady(guest, true);
  await manager.startRoomGame(host);
  assert.equal(room.game?.phase, 'setter_pick');
  assert.equal(room.hostId, 'u1');

  await manager.leaveRoom(host, { hardLeave: false });
  assert.equal(room.hostId, 'u1');
  assert.equal(room.game?.phase, 'setter_pick');

  const hostReconnect = makeSocket('s3', 'u1', 'host');
  ns.sockets.set(hostReconnect.id, hostReconnect);
  const resumed = await manager.attachActiveRoomForUser(hostReconnect);
  assert.equal(resumed?.code, room.code);
  assert.equal(room.hostId, 'u1');
  assert.equal(room.players.find((p) => p.userId === 'u1')?.connected, true);
  assert.equal(room.game?.phase, 'setter_pick');
});
