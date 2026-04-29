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

const strongPassword = 'TestUser123!@#';

describe('Auth API', () => {
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

  it('POST /api/v1/auth/register creates user and sets cookies', async () => {
    const email = `int_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `u${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);

    assert.ok(res.body?.data?.user?.email === email);
    const setCookie = res.headers['set-cookie'];
    assert.ok(Array.isArray(setCookie) && setCookie.some((c) => c.startsWith('access_token=')));
    assert.ok(setCookie.some((c) => c.startsWith('refresh_token=')));
  });

  it('POST /api/v1/auth/login rejects wrong password', async () => {
    const email = `login_${Date.now()}@example.com`;
    const username = `log${Date.now()}`;
    await request(app).post('/api/v1/auth/register').send({
      username,
      email,
      password: strongPassword,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrongpass123!@#' })
      .expect(401);

    assert.ok(res.body?.error?.message);
  });

  it('refresh rotates cookie and keeps protected route available', async () => {
    const email = `refresh_${Date.now()}@example.com`;
    const username = `ref${Date.now()}`;
    const register = await request(app).post('/api/v1/auth/register').send({
      username,
      email,
      password: strongPassword,
    });
    const cookies = register.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));

    const meBefore = await request(app).get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
    assert.equal(meBefore.body?.data?.user?.email, email);

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(200);
    const rotatedCookies = refresh.headers['set-cookie'];
    assert.ok(Array.isArray(rotatedCookies));
    assert.ok(rotatedCookies.some((c) => c.startsWith('refresh_token=')));

    const meAfter = await request(app).get('/api/v1/auth/me').set('Cookie', rotatedCookies).expect(200);
    assert.equal(meAfter.body?.data?.user?.email, email);
  });
});
