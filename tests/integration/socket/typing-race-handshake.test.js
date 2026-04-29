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

  it('caps typing_progress_update rate to prevent event storms', async () => {
    const stamp = Date.now();
    const mkUser = async (name) => {
      const email = `${name}_${stamp}@example.com`;
      const reg = await request(stack.server)
        .post('/api/v1/auth/register')
        .send({
          username: `${name}${stamp}`,
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
      return hs.body?.data?.token;
    };

    const [tokenA, tokenB] = await Promise.all([mkUser('tr_a'), mkUser('tr_b')]);
    assert.ok(tokenA && tokenB);

    const a = ioClient(`${stack.baseUrl}/typing-race`, {
      path: '/socket.io',
      auth: { token: tokenA },
      transports: ['websocket'],
    });
    const b = ioClient(`${stack.baseUrl}/typing-race`, {
      path: '/socket.io',
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    const waitConnected = (socket) =>
      new Promise((resolve, reject) => {
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

    const emitAck = (socket, event, payload) =>
      new Promise((resolve, reject) => {
        socket.timeout(5000).emit(event, payload, (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        });
      });

    try {
      await Promise.all([waitConnected(a), waitConnected(b)]);

      const created = await emitAck(a, 'typing_create_room', {});
      assert.equal(created.ok, true);
      const roomCode = created.data?.roomCode;
      assert.equal(typeof roomCode, 'string');

      const joined = await emitAck(b, 'typing_join_room', { roomCode });
      assert.equal(joined.ok, true);

      assert.equal((await emitAck(a, 'typing_set_ready', { ready: true })).ok, true);
      assert.equal((await emitAck(b, 'typing_set_ready', { ready: true })).ok, true);
      assert.equal((await emitAck(a, 'typing_start_countdown', {})).ok, true);

      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('race start timeout')), 7000);
        a.once('typing_race_started', () => {
          clearTimeout(t);
          resolve(undefined);
        });
      });

      let okCount = 0;
      let limitedCount = 0;
      const burst = [];
      for (let i = 0; i < 40; i++) {
        burst.push(
          emitAck(a, 'typing_progress_update', {
            cursorDisplay: i + 1,
            cursor: i + 1,
            errorLen: 0,
            wpm: 80,
          }).then((res) => {
            if (res?.ok) okCount += 1;
            if (res?.error?.code === 'RATE_LIMITED') limitedCount += 1;
          }),
        );
      }
      await Promise.all(burst);

      assert.ok(okCount > 0, 'some progress updates should pass');
      assert.ok(limitedCount > 0, 'burst should trigger RATE_LIMITED responses');
    } finally {
      a.disconnect();
      b.disconnect();
    }
  });
});
