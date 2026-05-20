import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { applyTestEnv } from '../../support/testEnv.js';
import { startSocketTestStack } from '../../support/socketTestStack.js';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../../support/mongoTestHarness.js';
import { registerSocketUser, waitSocketConnected } from '../../support/socketTestHelpers.js';

describe('GET /health/metrics socket handshake counters', () => {
  /** @type {Awaited<ReturnType<typeof startSocketTestStack>>} */
  let stack;

  before(async () => {
    await startMongoMemoryServer();
    const env = applyTestEnv();
    await connectMongoose();
    await dropAllCollections();
    stack = await startSocketTestStack(env);
  });

  after(async () => {
    if (stack) await stack.stop();
    await stopMongoMemoryServer();
  });

  it('increments socket_handshake_fail without credentials', async () => {
    const before = await request(stack.server).get('/health/metrics').expect(200);
    const failBefore = before.body?.counters?.socket_handshake_fail ?? 0;

    const socket = ioClient(`${stack.baseUrl}/npat`, {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket'],
    });
    await new Promise((resolve) => {
      socket.once('connect_error', () => resolve(undefined));
      socket.connect();
    });
    socket.close();

    const after = await request(stack.server).get('/health/metrics').expect(200);
    assert.ok((after.body?.counters?.socket_handshake_fail ?? 0) > failBefore);
  });

  it('increments socket_handshake_ok with valid admission token', async () => {
    const before = await request(stack.server).get('/health/metrics').expect(200);
    const okBefore = before.body?.counters?.socket_handshake_ok ?? 0;

    const { token } = await registerSocketUser(stack.server, 'metrics_ok');
    const socket = ioClient(`${stack.baseUrl}/npat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });
    await waitSocketConnected(socket);
    socket.disconnect();

    const after = await request(stack.server).get('/health/metrics').expect(200);
    assert.ok((after.body?.counters?.socket_handshake_ok ?? 0) > okBefore);
  });
});
