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

const strongPassword = 'Reconn123!@#ab';
const ACK_MS = 15_000;

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {string} event
 * @param {unknown} [payload]
 */
function emitAck(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), ACK_MS);
    socket.timeout(ACK_MS).emit(event, payload, (err, res) => {
      clearTimeout(t);
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });
}

/**
 * @param {string} baseUrl
 */
async function registerUser(baseUrl, label) {
  const stamp = Date.now();
  const reg = await request(baseUrl)
    .post('/api/v1/auth/register')
    .send({
      username: `rc${label}${stamp}`,
      email: `rc_${label}_${stamp}@example.com`,
      password: strongPassword,
    })
    .expect(201);
  const cookies = reg.headers['set-cookie'];
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
  const hs = await request(baseUrl)
    .get('/api/v1/auth/socket-admission')
    .set('Cookie', cookieHeader)
    .expect(200);
  const token = hs.body?.data?.token;
  assert.ok(token);
  return { token, userId: reg.body?.data?.user?.id, cookies: cookieHeader };
}

describe('Reconnect resilience (integration)', () => {
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

  it('NPAT get_room_state succeeds immediately after reconnect attach', async () => {
    const { token } = await registerUser(stack.baseUrl, 'npat');

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
      socket.once('connect_error', reject);
    });

    const created = await emitAck(socket, 'create_room', { mode: 'solo' });
    assert.equal(created.ok, true);
    const code = created.data?.room?.code;
    assert.ok(code);

    socket.disconnect();

    const socket2 = ioClient(`${stack.baseUrl}/npat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reconnect timeout')), 5000);
      socket2.once('connect', () => {
        clearTimeout(t);
        resolve(undefined);
      });
      socket2.once('connect_error', reject);
    });

    const state = await emitAck(socket2, 'get_room_state', {});
    assert.equal(state.ok, true, `expected get_room_state ok, got ${state.error?.code}`);
    assert.equal(state.data?.room?.code, code);

    socket2.disconnect();
  });

  it('Hangman non-host cannot return_to_lobby', async () => {
    const host = await registerUser(stack.baseUrl, 'hmh');
    const guest = await registerUser(stack.baseUrl, 'hmg');

    const hostSocket = ioClient(`${stack.baseUrl}/hangman`, {
      path: '/socket.io',
      auth: { token: host.token },
      transports: ['websocket'],
    });
    const guestSocket = ioClient(`${stack.baseUrl}/hangman`, {
      path: '/socket.io',
      auth: { token: guest.token },
      transports: ['websocket'],
    });

    const waitConnect = (s) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
        s.once('connect', () => {
          clearTimeout(t);
          resolve(undefined);
        });
        s.once('connect_error', reject);
      });

    await Promise.all([waitConnect(hostSocket), waitConnect(guestSocket)]);

    const created = await emitAck(hostSocket, 'create_room', {});
    assert.equal(created.ok, true);
    const code = created.data?.room?.code;
    assert.ok(code);

    const joined = await emitAck(guestSocket, 'join_room', { code });
    assert.equal(joined.ok, true);

    const denied = await emitAck(guestSocket, 'return_to_lobby', {});
    assert.equal(denied.ok, false);
    assert.equal(denied.error?.code, 'NOT_HOST');

    hostSocket.disconnect();
    guestSocket.disconnect();
  });

  it('auth refresh after cookie rotation keeps socket admission valid', async () => {
    const { cookies } = await registerUser(stack.baseUrl, 'auth');

    const refresh = await request(stack.baseUrl)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);
    const rotated = refresh.headers['set-cookie'];
    assert.ok(Array.isArray(rotated));

    const hs = await request(stack.baseUrl)
      .get('/api/v1/auth/socket-admission')
      .set('Cookie', rotated.map((c) => c.split(';')[0]).join('; '))
      .expect(200);
    assert.ok(hs.body?.data?.token);
  });
});
