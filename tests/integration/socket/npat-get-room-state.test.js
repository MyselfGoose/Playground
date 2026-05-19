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

const strongPassword = 'TestUser123!@#';

describe('NPAT get_room_state', () => {
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

  it('returns current room after join via get_room_state ack', async () => {
    const email = `npat_grs_${Date.now()}@example.com`;
    const register = await request(stack.server)
      .post('/api/v1/auth/register')
      .send({ username: `np${Date.now()}`, email, password: strongPassword })
      .expect(201);

    const cookies = register.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    const admission = await request(stack.server)
      .get('/api/v1/auth/socket-admission')
      .set('Cookie', cookieHeader)
      .expect(200);
    const token = admission.body?.data?.token;
    assert.ok(typeof token === 'string' && token.length > 10);

    const socket = ioClient(`${stack.baseUrl}/npat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 8000);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve(undefined);
      });
      socket.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });

    const created = await new Promise((resolve, reject) => {
      socket.timeout(5000).emit('create_room', { mode: 'solo' }, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    assert.equal(created?.ok, true);
    assert.ok(created?.data?.room?.code);

    const state = await new Promise((resolve, reject) => {
      socket.timeout(5000).emit('get_room_state', {}, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    assert.equal(state?.ok, true);
    assert.equal(state?.data?.room?.code, created.data.room.code);
    assert.equal(state?.data?.room?.mode, 'free-for-all');
    assert.equal(state?.data?.room?.state, 'WAITING');

    const roomCode = created.data.room.code;
    socket.disconnect();

    const socket2 = ioClient(`${stack.baseUrl}/npat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    const resumedPayload = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reconnect timeout')), 10000);
      socket2.once('connect', () => {
        socket2.once('session_resumed', (payload) => {
          clearTimeout(t);
          resolve(payload);
        });
      });
      socket2.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });

    assert.equal(resumedPayload?.room?.code, roomCode);
    assert.equal(resumedPayload?.room?.state, 'WAITING');

    const stateAfterReconnect = await new Promise((resolve, reject) => {
      socket2.timeout(5000).emit('get_room_state', {}, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    assert.equal(stateAfterReconnect?.ok, true);
    assert.equal(stateAfterReconnect?.data?.room?.code, roomCode);

    socket2.disconnect();
  });
});
