import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applyTestEnv } from '../../support/testEnv.js';
import { createTestApp } from '../../support/appFactory.js';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../../support/mongoTestHarness.js';

const strongPassword = 'FriendsTest123!@#';

/**
 * @param {import('express').Express} app
 * @param {string} label
 */
async function registerUser(app, label) {
  const stamp = Date.now();
  const username = `fr${label}${stamp}`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      username,
      email: `fr_${label}_${stamp}@example.com`,
      password: strongPassword,
    })
    .expect(201);
  const cookies = res.headers['set-cookie'];
  assert.ok(Array.isArray(cookies));
  return {
    username,
    userId: res.body?.data?.user?.id ?? res.body?.data?.user?._id,
    cookies,
  };
}

describe('Friends API', () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    await startMongoMemoryServer();
    const env = applyTestEnv();
    app = createTestApp({ env });
    await connectMongoose();
    await dropAllCollections();
  });

  after(async () => {
    await stopMongoMemoryServer();
  });

  it('send → accept → summary lists friend', async () => {
    const alice = await registerUser(app, 'a');
    const bob = await registerUser(app, 'b');

    const sent = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    const requestId = sent.body?.data?.friendship?.id;
    assert.ok(requestId);

    await request(app)
      .post(`/api/v1/friends/requests/${requestId}/accept`)
      .set('Cookie', bob.cookies)
      .expect(200);

    const summary = await request(app)
      .get('/api/v1/friends/summary')
      .set('Cookie', alice.cookies)
      .expect(200);

    const friends = summary.body?.data?.friends ?? [];
    assert.equal(friends.length, 1);
    assert.equal(friends[0].username, bob.username);
    assert.equal(friends[0].online, false);
  });

  it('send → decline shows declined in sender summary', async () => {
    const alice = await registerUser(app, 'c');
    const bob = await registerUser(app, 'd');

    const sent = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(app)
      .post(`/api/v1/friends/requests/${sent.body.data.friendship.id}/decline`)
      .set('Cookie', bob.cookies)
      .expect(200);

    const summary = await request(app)
      .get('/api/v1/friends/summary')
      .set('Cookie', alice.cookies)
      .expect(200);

    const sentRows = summary.body?.data?.pending?.sent ?? [];
    assert.equal(sentRows.length, 1);
    assert.equal(sentRows[0].status, 'declined');
  });

  it('cancel removes pending received request', async () => {
    const alice = await registerUser(app, 'e');
    const bob = await registerUser(app, 'f');

    const sent = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(app)
      .delete(`/api/v1/friends/requests/${sent.body.data.friendship.id}`)
      .set('Cookie', alice.cookies)
      .expect(200);

    const summary = await request(app)
      .get('/api/v1/friends/summary')
      .set('Cookie', bob.cookies)
      .expect(200);

    assert.equal((summary.body?.data?.pending?.received ?? []).length, 0);
  });

  it('unfriend removes accepted friendship', async () => {
    const alice = await registerUser(app, 'g');
    const bob = await registerUser(app, 'h');

    const sent = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    await request(app)
      .post(`/api/v1/friends/requests/${sent.body.data.friendship.id}/accept`)
      .set('Cookie', bob.cookies)
      .expect(200);

    await request(app)
      .delete(`/api/v1/friends/${bob.userId}`)
      .set('Cookie', alice.cookies)
      .expect(200);

    const summary = await request(app)
      .get('/api/v1/friends/summary')
      .set('Cookie', alice.cookies)
      .expect(200);

    assert.equal((summary.body?.data?.friends ?? []).length, 0);
  });

  it('lookup returns relationship for target user', async () => {
    const alice = await registerUser(app, 'i');
    const bob = await registerUser(app, 'j');

    const before = await request(app)
      .get(`/api/v1/friends/lookup/${bob.username}`)
      .set('Cookie', alice.cookies)
      .expect(200);
    assert.equal(before.body?.data?.relationship, 'none');

    await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(201);

    const after = await request(app)
      .get(`/api/v1/friends/lookup/${bob.username}`)
      .set('Cookie', alice.cookies)
      .expect(200);
    assert.equal(after.body?.data?.relationship, 'pending_sent');
  });

  it('rejects self-friend and unknown username', async () => {
    const alice = await registerUser(app, 'k');

    const self = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: alice.username })
      .expect(400);
    assert.equal(self.body?.error?.code, 'CANNOT_FRIEND_SELF');

    const missing = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: 'nobody_here_ever' })
      .expect(404);
    assert.equal(missing.body?.error?.code, 'USER_NOT_FOUND');
  });

  it('mutual pending auto-accepts friendship', async () => {
    const alice = await registerUser(app, 'l');
    const bob = await registerUser(app, 'm');

    await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', bob.cookies)
      .send({ username: alice.username })
      .expect(201);

    const mutual = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', alice.cookies)
      .send({ username: bob.username })
      .expect(200);

    assert.equal(mutual.body?.data?.autoAccepted, true);
    assert.equal(mutual.body?.data?.friendship?.status, 'accepted');
  });
});
