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

const strongPassword = 'LbUser123!@#xx';

describe('Leaderboard API', () => {
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

  it('GET /api/v1/leaderboard/typing/wpm returns 200 with data shape', async () => {
    const res = await request(app).get('/api/v1/leaderboard/typing/wpm').expect(200);
    assert.ok(res.body?.data);
    assert.ok(Array.isArray(res.body.data.entries));
    assert.equal(typeof res.body.data.total, 'number');
  });

  it('POST /api/v1/leaderboard/typing/solo returns 401 without auth', async () => {
    await request(app)
      .post('/api/v1/leaderboard/typing/solo')
      .send({
        passageLength: 100,
        correctChars: 80,
        incorrectChars: 5,
        extraChars: 0,
        wpm: 60,
        rawWpm: 65,
        elapsedMs: 60_000,
      })
      .expect(401);
  });

  it('POST /api/v1/leaderboard/typing/solo returns 400 on invalid body', async () => {
    const email = `solo_${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `s${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'];
    assert.ok(cookies);

    const bad = await request(app)
      .post('/api/v1/leaderboard/typing/solo')
      .set('Cookie', cookies)
      .send({
        passageLength: 0,
        correctChars: 0,
        incorrectChars: 0,
        extraChars: 0,
        wpm: 0,
        rawWpm: 0,
        elapsedMs: 0,
      })
      .expect(400);

    assert.ok(bad.body?.error?.message, 'expected validation error message');
  });

  it('POST /api/v1/leaderboard/typing/solo returns 201 when authenticated and valid', async () => {
    const email = `solo2_${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `s2${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'];

    await request(app)
      .post('/api/v1/leaderboard/typing/solo')
      .set('Cookie', cookies)
      .send({
        passageLength: 100,
        correctChars: 80,
        incorrectChars: 5,
        extraChars: 0,
        wpm: 60,
        rawWpm: 65,
        elapsedMs: 60_000,
      })
      .expect(201);
  });
});
