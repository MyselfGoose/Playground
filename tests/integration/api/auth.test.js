import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applyTestEnv } from '../../support/testEnv.js';
import { createTestApp } from '../../support/appFactory.js';
import { refreshSessionRepository } from '../../../backend/src/repositories/refreshSessionRepository.js';
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

  it('parallel refresh within grace merges without TOKEN_REUSE', async () => {
    const email = `parallel_${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `par${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);
    const cookies = register.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));

    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookies),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookies),
    ]);

    const statuses = [a.status, b.status].sort();
    assert.ok(statuses.includes(200), `expected one 200, got ${statuses.join(',')}`);
    assert.ok(!statuses.every((s) => s === 401), 'should not both fail with TOKEN_REUSE');

    const winnerCookies = a.status === 200 ? a.headers['set-cookie'] : b.headers['set-cookie'];
    assert.ok(Array.isArray(winnerCookies));
    await request(app).get('/api/v1/auth/me').set('Cookie', winnerCookies).expect(200);
  });

  it('grace merge survives delayed createSession without TOKEN_REUSE', async () => {
    const email = `delay_${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `dly${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);
    const cookies = register.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));

    const originalCreate = refreshSessionRepository.createSession.bind(refreshSessionRepository);
    refreshSessionRepository.createSession = async (params) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      return originalCreate(params);
    };

    try {
      const [a, b] = await Promise.all([
        request(app).post('/api/v1/auth/refresh').set('Cookie', cookies),
        request(app).post('/api/v1/auth/refresh').set('Cookie', cookies),
      ]);

      const codes = [a.body?.error?.code, b.body?.error?.code].filter(Boolean);
      assert.ok(!codes.includes('TOKEN_REUSE'), `unexpected TOKEN_REUSE: ${JSON.stringify(codes)}`);

      const statuses = [a.status, b.status].sort();
      assert.ok(statuses.includes(200), `expected one 200, got ${statuses.join(',')}`);

      const winnerCookies = a.status === 200 ? a.headers['set-cookie'] : b.headers['set-cookie'];
      assert.ok(Array.isArray(winnerCookies));
      await request(app).get('/api/v1/auth/me').set('Cookie', winnerCookies).expect(200);
    } finally {
      refreshSessionRepository.createSession = originalCreate;
    }
  });

  it('GET /me returns 401 without access token then succeeds after refresh', async () => {
    const email = `me_refresh_${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `me${Date.now()}`,
        email,
        password: strongPassword,
      })
      .expect(201);
    const cookies = register.headers['set-cookie'];
    assert.ok(Array.isArray(cookies));

    const refreshOnly = cookies.filter((c) => !c.startsWith('access_token='));
    assert.ok(refreshOnly.some((c) => c.startsWith('refresh_token=')));

    await request(app).get('/api/v1/auth/me').set('Cookie', refreshOnly).expect(401);

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(200);
    const rotatedCookies = refresh.headers['set-cookie'];
    assert.ok(Array.isArray(rotatedCookies));

    const meAfter = await request(app).get('/api/v1/auth/me').set('Cookie', rotatedCookies).expect(200);
    assert.equal(meAfter.body?.data?.user?.email, email);
  });
});
