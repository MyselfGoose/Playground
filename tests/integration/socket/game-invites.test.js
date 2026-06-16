import { describe, it, before, after, afterEach } from 'node:test';
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
import { registerRoomAccessor, clearRoomInviteRegistry } from '../../../backend/src/realtime/roomInviteRegistry.js';

const strongPassword = 'Invite123!@#ab';
const CONNECT_MS = 10_000;

/**
 * @param {string} baseUrl
 * @param {string} label
 */
async function registerUser(baseUrl, label) {
  const stamp = Date.now();
  const reg = await request(baseUrl)
    .post('/api/v1/auth/register')
    .send({
      username: `gi${label}${stamp}`,
      email: `gi_${label}_${stamp}@example.com`,
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
  return {
    token,
    userId: reg.body?.data?.user?.id ?? reg.body?.data?.user?._id,
    username: reg.body?.data?.user?.username,
    cookies: cookieHeader,
  };
}

/** @type {import('socket.io-client').Socket[]} */
const openSockets = [];

/**
 * @param {string} baseUrl
 * @param {string} token
 */
async function connectSocial(baseUrl, token) {
  const socket = ioClient(`${baseUrl}/social`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
  openSockets.push(socket);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('social connect timeout')), CONNECT_MS);
    socket.once('connect', () => {
      clearTimeout(t);
      resolve(undefined);
    });
    socket.once('connect_error', reject);
  });
  return socket;
}

describe('game invite socket + API', () => {
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
    for (const s of openSockets) s.close();
    openSockets.length = 0;
    clearRoomInviteRegistry();
    if (stack) await stack.stop();
    await stopMongoMemoryServer();
  });

  afterEach(async () => {
    for (const s of openSockets.splice(0)) {
      s.removeAllListeners();
      s.disconnect();
    }
    await dropAllCollections();
  });

  it('sends invite, delivers socket event, accepts invite', async () => {
    const host = await registerUser(stack.baseUrl, 'host');
    const friend = await registerUser(stack.baseUrl, 'friend');

    await request(stack.baseUrl)
      .post('/api/v1/friends/requests')
      .set('Cookie', host.cookies)
      .send({ username: friend.username })
      .expect(201);

    const friendSummary = await request(stack.baseUrl)
      .get('/api/v1/friends/summary')
      .set('Cookie', friend.cookies)
      .expect(200);
    const receivedReq = friendSummary.body?.data?.pending?.received?.[0];
    assert.ok(receivedReq?.id);
    await request(stack.baseUrl)
      .post(`/api/v1/friends/requests/${receivedReq.id}/accept`)
      .set('Cookie', friend.cookies)
      .expect(200);

    registerRoomAccessor('hangman', {
      getInviteContext(code) {
        if (code !== 'TEST') {
          return { exists: false, hostId: null, playerUserIds: [], joinable: false };
        }
        return {
          exists: true,
          hostId: host.userId,
          playerUserIds: [host.userId],
          joinable: true,
        };
      },
    });

    const friendSocket = await connectSocial(stack.baseUrl, friend.token);
    const invitePromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('invite timeout')), CONNECT_MS);
      friendSocket.once('game_invite_received', (payload) => {
        clearTimeout(t);
        resolve(payload);
      });
    });

    const hostSocket = await connectSocial(stack.baseUrl, host.token);
    const resolvedPromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('resolved timeout')), CONNECT_MS);
      hostSocket.once('game_invite_resolved', (payload) => {
        clearTimeout(t);
        resolve(payload);
      });
    });

    const sendRes = await request(stack.baseUrl)
      .post('/api/v1/game-invites')
      .set('Cookie', host.cookies)
      .send({ recipientId: friend.userId, gameSlug: 'hangman', roomCode: 'TEST' })
      .expect(201);

    const inviteId = sendRes.body?.data?.invite?.id;
    assert.ok(inviteId);

    const socketPayload = await invitePromise;
    assert.equal(socketPayload?.invite?.id, inviteId);

    const acceptRes = await request(stack.baseUrl)
      .post(`/api/v1/game-invites/${inviteId}/accept`)
      .set('Cookie', friend.cookies)
      .expect(200);

    assert.equal(acceptRes.body?.data?.gameSlug, 'hangman');
    assert.equal(acceptRes.body?.data?.roomCode, 'TEST');

    const resolved = await resolvedPromise;
    assert.equal(resolved?.inviteId, inviteId);
    assert.equal(resolved?.status, 'accepted');

    const markReadRes = await request(stack.baseUrl)
      .post('/api/v1/game-invites/mark-read')
      .set('Cookie', friend.cookies)
      .send({})
      .expect(200);
    assert.equal(markReadRes.body?.data?.counts?.unread, 0);
  });
});
