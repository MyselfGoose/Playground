import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../../support/mongoTestHarness.js';
import { applyTestEnv } from '../../support/testEnv.js';
import { startSocketTestStack } from '../../support/socketTestStack.js';

const strongPassword = 'TrUser123!@#ab';

describe('Typing race Socket.IO handshake', () => {
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

  it('connects with token from socket-handshake', async () => {
    const email = `tr_${Date.now()}@example.com`;
    const reg = await request(stack.server)
      .post('/api/v1/auth/register')
      .send({
        username: `tr${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    const hs = await request(stack.server)
      .get('/api/v1/auth/socket-handshake')
      .set('Cookie', cookieHeader)
      .expect(200);
    const token = hs.body?.data?.token;
    assert.ok(token);

    const socket = ioClient(`${stack.baseUrl}/typing-race`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve(undefined);
      });
      socket.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });

    assert.ok(socket.connected);
    socket.disconnect();
  });
});
