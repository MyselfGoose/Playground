import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_DISCONNECT_GRACE_MS } from '../../realtime/constants.js';
import { createCahRoomManager } from './roomManager.js';

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

test('CAH soft disconnect defers connected=false until grace expires', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => {
    mock.timers.reset();
  });

  const ns = makeNs();
  const manager = createCahRoomManager({ cahNs: ns, logger: console, maxPlayers: 10 });
  const host = makeSocket('s1', 'u1', 'host');
  const p2 = makeSocket('s2', 'u2', 'two');
  const p3 = makeSocket('s3', 'u3', 'three');
  ns.sockets.set(host.id, host);
  ns.sockets.set(p2.id, p2);
  ns.sockets.set(p3.id, p3);

  const room = await manager.createRoom(host, {});
  await manager.joinRoom(p2, room.code);
  await manager.joinRoom(p3, room.code);

  await manager.leaveRoom(p2, { hardLeave: false });
  const player = room.players.find((p) => p.userId === 'u2');
  assert.equal(player?.presenceStatus, 'disconnect_pending');
  assert.equal(player?.connected, true);

  mock.timers.tick(PLAYER_DISCONNECT_GRACE_MS);
  assert.equal(player?.presenceStatus, 'gone');
  assert.equal(player?.connected, false);
});
