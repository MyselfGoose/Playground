import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applyTestEnv } from '../../support/testEnv.js';
import { createTestApp } from '../../support/appFactory.js';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  disconnectMongoose,
} from '../../support/mongoTestHarness.js';

const strongPassword = 'TestUser123!@#';

describe('Mongo readiness gating (disconnected)', () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    await disconnectMongoose();
    const env = applyTestEnv();
    app = createTestApp({ env });
  });

  it('GET /health/live returns 200 without Mongo', async () => {
    const res = await request(app).get('/health/live').expect(200);
    assert.equal(res.body.ok, true);
  });

  it('GET /health/ready returns 503 when Mongo is not connected', async () => {
    const res = await request(app).get('/health/ready').expect(503);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.reason, 'mongodb_not_connected');
    assert.notEqual(res.body.mongoReadyState, 1);
  });

  it('POST /api/v1/auth/register returns 503 MONGODB_NOT_READY without Mongo', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `u${Date.now()}`,
        email: `gate_${Date.now()}@example.com`,
        password: strongPassword,
      })
      .expect(503);

    assert.equal(res.body?.error?.code, 'MONGODB_NOT_READY');
    assert.notEqual(res.body.mongoReadyState, 1);
  });

  it('GET /api/v1 returns 200 without Mongo (non-DB route)', async () => {
    const res = await request(app).get('/api/v1').expect(200);
    assert.equal(res.body.ok, true);
  });
});

describe('Mongo readiness gating (connected)', () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    await startMongoMemoryServer();
    const env = applyTestEnv();
    app = createTestApp({ env });
    await connectMongoose();
  });

  after(async () => {
    await stopMongoMemoryServer();
  });

  it('GET /health/ready returns 200 when Mongo is connected', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.mongoReadyState, 1);
  });

  it('POST /api/v1/auth/register succeeds when Mongo is connected', async () => {
    const email = `ready_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `u${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    assert.equal(res.body?.data?.user?.email, email);
  });
});
