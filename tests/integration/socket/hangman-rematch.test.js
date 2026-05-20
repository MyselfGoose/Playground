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

const strongPassword = 'HmRematch123!@#ab';
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
      username: `hm${label}${stamp}`,
      email: `hm_${label}_${stamp}@example.com`,
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
  return { token, userId: reg.body?.data?.user?.id };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 */
function connectHangman(baseUrl, token) {
  return ioClient(`${baseUrl}/hangman`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
}

describe('Hangman play_again rematch', () => {
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

  it('play_again after game_end returns lobby with players ready', async () => {
    const hostAuth = await registerUser(stack.baseUrl, 'host');
    const guestAuth = await registerUser(stack.baseUrl, 'guest');

    const hostSocket = connectHangman(stack.baseUrl, hostAuth.token);
    const guestSocket = connectHangman(stack.baseUrl, guestAuth.token);

    await Promise.all([
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('host connect timeout')), 5000);
        hostSocket.once('connect', () => {
          clearTimeout(t);
          resolve(undefined);
        });
        hostSocket.once('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('guest connect timeout')), 5000);
        guestSocket.once('connect', () => {
          clearTimeout(t);
          resolve(undefined);
        });
        guestSocket.once('connect_error', reject);
      }),
    ]);

    const created = await emitAck(hostSocket, 'create_room', {});
    assert.equal(created?.ok, true);
    const code = created?.data?.room?.code;
    assert.ok(code);

    const joined = await emitAck(guestSocket, 'join_room', { code });
    assert.equal(joined?.ok, true);

    await emitAck(hostSocket, 'set_ready', { ready: true });
    await emitAck(guestSocket, 'set_ready', { ready: true });

    await new Promise((resolve) => setTimeout(resolve, 5500));

    const hostState = await emitAck(hostSocket, 'get_room_state', {});
    assert.equal(hostState?.ok, true, JSON.stringify(hostState));
    assert.equal(hostState?.data?.room?.game?.phase, 'setter_pick', JSON.stringify(hostState?.data?.room?.game));

    await emitAck(hostSocket, 'setter_submit_word', { word: 'cats' });
    for (const letter of ['c', 'a', 't', 's']) {
      await emitAck(guestSocket, 'guess_letter', { letter });
    }
    await emitAck(hostSocket, 'next_round', {});

    await emitAck(guestSocket, 'setter_submit_word', { word: 'frog' });
    for (const letter of ['f', 'r', 'o', 'g']) {
      await emitAck(hostSocket, 'guess_letter', { letter });
    }
    const ended = await emitAck(hostSocket, 'next_round', {});
    assert.equal(ended?.ok, true, JSON.stringify(ended));
    assert.equal(ended?.data?.room?.game?.phase, 'game_end', JSON.stringify(ended?.data?.room?.game));

    const again = await emitAck(hostSocket, 'play_again', {});
    assert.equal(again?.ok, true, JSON.stringify(again));
    assert.equal(again?.data?.room?.game, null);
    assert.ok(again?.data?.room?.players?.every((p) => p.ready === true));

    await new Promise((resolve) => setTimeout(resolve, 5500));
    const lobbyState = await emitAck(hostSocket, 'get_room_state', {});
    assert.equal(lobbyState?.data?.room?.game?.phase, 'setter_pick', JSON.stringify(lobbyState?.data?.room));

    hostSocket.disconnect();
    guestSocket.disconnect();
  });
});
