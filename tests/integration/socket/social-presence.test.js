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

const strongPassword = 'Social123!@#ab';
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
      username: `sp${label}${stamp}`,
      email: `sp_${label}_${stamp}@example.com`,
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
 * @param {import('socket.io-client').Socket} socket
 */
function trackSocket(socket) {
  openSockets.push(socket);
  return socket;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 */
async function connectSocial(baseUrl, token) {
  const socket = trackSocket(
    ioClient(`${baseUrl}/social`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    }),
  );
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

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {string} event
 */
function waitForEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} timeout`)), CONNECT_MS);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

describe('Social presence (integration)', () => {
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

  afterEach(() => {
    for (const socket of openSockets.splice(0)) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  });

  it('friend_online and friend_offline propagate between accepted friends', async () => {
    const alice = await registerUser(stack.baseUrl, 'a');
    const bob = await registerUser(stack.baseUrl, 'b');

    const sent = await request(stack.baseUrl)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(stack.baseUrl)
      .post(`/api/v1/friends/requests/${sent.body.data.friendship.id}/accept`)
      .set('Cookie', bob.cookies)
      .expect(200);

    const bobSocket = await connectSocial(stack.baseUrl, bob.token);
    const onlinePromise = waitForEvent(bobSocket, 'friend_online');

    const aliceSocket = await connectSocial(stack.baseUrl, alice.token);
    const onlinePayload = await onlinePromise;
    assert.equal(onlinePayload.userId, alice.userId);

    const offlinePromise = waitForEvent(bobSocket, 'friend_offline');
    aliceSocket.disconnect();
    const offlinePayload = await offlinePromise;
    assert.equal(offlinePayload.userId, alice.userId);
    assert.ok(offlinePayload.lastSeenAt);

    bobSocket.disconnect();
  });

  it('multiple tabs keep user online until last disconnect', async () => {
    const alice = await registerUser(stack.baseUrl, 'c');
    const bob = await registerUser(stack.baseUrl, 'd');

    const sent = await request(stack.baseUrl)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(stack.baseUrl)
      .post(`/api/v1/friends/requests/${sent.body.data.friendship.id}/accept`)
      .set('Cookie', bob.cookies)
      .expect(200);

    const bobSocket = await connectSocial(stack.baseUrl, bob.token);
    const onlinePromise = waitForEvent(bobSocket, 'friend_online');

    const tab1 = await connectSocial(stack.baseUrl, alice.token);
    await onlinePromise;

    const tab2 = await connectSocial(stack.baseUrl, alice.token);
    let offlineFired = false;
    bobSocket.on('friend_offline', () => {
      offlineFired = true;
    });

    tab1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(offlineFired, false);

    const offlinePromise = waitForEvent(bobSocket, 'friend_offline');
    tab2.disconnect();
    await offlinePromise;

    bobSocket.disconnect();
  });

  it('presence_snapshot includes online friend ids on connect', async () => {
    const alice = await registerUser(stack.baseUrl, 'e');
    const bob = await registerUser(stack.baseUrl, 'f');

    const sent = await request(stack.baseUrl)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(stack.baseUrl)
      .post(`/api/v1/friends/requests/${sent.body.data.friendship.id}/accept`)
      .set('Cookie', bob.cookies)
      .expect(200);

    const aliceSocket = await connectSocial(stack.baseUrl, alice.token);

    const bobSocket = trackSocket(
      ioClient(`${stack.baseUrl}/social`, {
        path: '/socket.io',
        auth: { token: bob.token },
        transports: ['websocket'],
      }),
    );

    const snapshot = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('snapshot timeout')), CONNECT_MS);
      bobSocket.once('presence_snapshot', (payload) => {
        clearTimeout(t);
        resolve(payload);
      });
      bobSocket.once('connect_error', reject);
      bobSocket.connect();
    });

    assert.ok(Array.isArray(snapshot.onlineFriendIds));
    assert.ok(snapshot.onlineFriendIds.includes(alice.userId));

    bobSocket.disconnect();
  });
});
