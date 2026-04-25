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

const strongPassword = 'SockUser123!@#';

describe('NPAT Socket.IO handshake', () => {
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
    const socket = ioClient(`${stack.baseUrl}/npat`, {
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

  it('connects with access token from register', async () => {
    const email = `sock_${Date.now()}@example.com`;
    const reg = await request(stack.server)
      .post('/api/v1/auth/register')
      .send({
        username: `sock${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    const hs = await request(stack.server)
      .get('/api/v1/auth/socket-handshake')
      .set('Cookie', cookieHeader)
      .expect(200);
    const token = hs.body?.data?.token;
    assert.ok(typeof token === 'string' && token.length > 10, 'expected token from socket-handshake');

    const socket = ioClient(`${stack.baseUrl}/npat`, {
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
