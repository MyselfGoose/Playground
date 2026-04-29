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

describe('Users profile API', () => {
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

  it('returns 404 for unknown id', async () => {
    const missing = '67f4a1a0f50d2f8ddf000001';
    const res = await request(app).get(`/api/v1/users/${missing}/profile`).expect(404);
    assert.equal(res.body?.error?.code, 'USER_NOT_FOUND');
  });

  it('returns profile payload shape for existing user', async () => {
    const email = `upro_${Date.now()}@example.com`;
    const register = await request(app).post('/api/v1/auth/register').send({
      username: `upro${Date.now()}`,
      email,
      password: 'ProfileStrong123!@#',
    }).expect(201);
    const userId = register.body?.data?.user?._id;
    assert.ok(userId);

    await request(app).post('/api/v1/leaderboard/typing/solo')
      .set('Cookie', register.headers['set-cookie'])
      .send({
        passageLength: 100,
        correctChars: 90,
        incorrectChars: 4,
        extraChars: 1,
        wpm: 72,
        rawWpm: 75,
        elapsedMs: 60_000,
      })
      .expect(201);

    const res = await request(app).get(`/api/v1/users/${userId}/profile`).expect(200);
    assert.equal(res.body?.data?.user?.id, userId);
    assert.equal(typeof res.body?.data?.stats?.typing?.bestWpm, 'number');
    assert.equal(typeof res.body?.data?.stats?.npat?.averageScore, 'number');
    assert.equal(typeof res.body?.data?.stats?.global?.breakdown, 'object');
    assert.ok(Array.isArray(res.body?.data?.recentActivity));
    assert.equal(typeof res.body?.data?.rankingExplanation, 'string');
  });
});
