import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../../support/mongoTestHarness.js';
import { applyTestEnv } from '../../support/testEnv.js';
import { startSocketTestStack } from '../../support/socketTestStack.js';
import {
  registerSocketUser,
  emitAck,
  waitSocketConnected,
} from '../../support/socketTestHelpers.js';

describe('Taboo Socket.IO handshake', () => {
  /** @type {Awaited<ReturnType<typeof startSocketTestStack>>} */
  let stack;
  /** @type {import('../../backend/src/config/env.js').Env} */
  let env;

  before(async () => {
    await startMongoMemoryServer();
    env = applyTestEnv();
    await connectMongoose();
    await dropAllCollections();
    stack = await startSocketTestStack(env);
  });

  after(async () => {
    if (stack) await stack.stop();
    await stopMongoMemoryServer();
  });

  it('rejects connection without auth token', async () => {
    const socket = ioClient(`${stack.baseUrl}/taboo`, {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket'],
    });
    const err = await new Promise((resolve) => {
      socket.once('connect_error', resolve);
      socket.connect();
    });
    socket.close();
    assert.ok(err && typeof err.message === 'string', `expected connect_error, got ${err}`);
  });

  it('connects with socket admission token from register session', async () => {
    const { token } = await registerSocketUser(stack.server, 'taboo_hs');
    const socket = ioClient(`${stack.baseUrl}/taboo`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    await waitSocketConnected(socket);
    assert.ok(socket.connected);
    socket.disconnect();
  });

  it('create_room, join_room, and get_room_state return matching lobby snapshot', async () => {
    const { token: hostToken } = await registerSocketUser(stack.server, 'taboo_host');
    const { token: guestToken } = await registerSocketUser(stack.server, 'taboo_guest');

    const host = ioClient(`${stack.baseUrl}/taboo`, {
      path: '/socket.io',
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    const guest = ioClient(`${stack.baseUrl}/taboo`, {
      path: '/socket.io',
      auth: { token: guestToken },
      transports: ['websocket'],
    });

    try {
      await Promise.all([waitSocketConnected(host), waitSocketConnected(guest)]);

      const created = await emitAck(host, 'create_room', {});
      assert.equal(created?.ok, true);
      const roomCode = created?.data?.room?.code;
      assert.ok(typeof roomCode === 'string' && roomCode.length >= 4);

      const state = await emitAck(host, 'get_room_state', {});
      assert.equal(state?.ok, true);
      assert.equal(state?.data?.room?.code, roomCode);
      assert.equal(state?.data?.room?.game, null);

      const joined = await emitAck(guest, 'join_room', { code: roomCode });
      assert.equal(joined?.ok, true);
      assert.equal(joined?.data?.room?.code, roomCode);

      const guestState = await emitAck(guest, 'get_room_state', {});
      assert.equal(guestState?.ok, true);
      assert.equal(guestState?.data?.room?.code, roomCode);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });
});
