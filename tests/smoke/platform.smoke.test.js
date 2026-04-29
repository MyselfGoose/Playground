import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { spawn } from 'node:child_process';
import mongoose from '../../backend/node_modules/mongoose/index.js';
import { applyTestEnv } from '../support/testEnv.js';
import { createTestApp } from '../support/appFactory.js';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../support/mongoTestHarness.js';
import { User } from '../../backend/src/models/User.js';
import { RefreshSession } from '../../backend/src/models/RefreshSession.js';
import { validateGeminiGoldenResponse } from '../../backend/src/services/npat/npatGeminiContract.js';
import { createDeterministicGeminiMockResponse } from '../../backend/src/services/npat/npatGeminiModel.js';

/** @param {string[]} args @param {string} cwd @param {Record<string,string>} env */
function run(cmd, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => (out += String(d)));
    child.on('close', (code) => resolve({ code: code ?? 1, output: out }));
  });
}

describe('platform smoke', () => {
  let app;
  before(async () => {
    await startMongoMemoryServer();
    const env = applyTestEnv({ GEMINI_MOCK_MODE: 'true' });
    app = createTestApp({ env });
    await connectMongoose();
    await dropAllCollections();
  });

  after(async () => {
    await stopMongoMemoryServer();
  });

  it('api health endpoint returns aggregate service flags', async () => {
    const res = await request(app).get('/health').expect(200);
    assert.equal(typeof res.body.status, 'string');
    assert.equal(typeof res.body.services.db, 'boolean');
  });

  it('db connection and seed script integrity', async () => {
    assert.equal(mongoose.connection.readyState, 1);
    const seed = await run('node', ['scripts/seed.js'], 'backend', { MONGO_URI: process.env.MONGO_URI || '' });
    assert.equal(seed.code, 0, seed.output);
    const admin = await User.findOne({ username: 'admin' }).lean();
    const testUser = await User.findOne({ username: 'testuser' }).lean();
    assert.ok(admin);
    assert.ok(testUser);
  });

  it('schema consistency sanity checks for critical collections', () => {
    assert.equal(User.schema.path('email').instance, 'String');
    assert.equal(User.schema.path('passwordHash').instance, 'String');
    assert.equal(User.schema.path('roles').instance, 'Array');
    assert.equal(RefreshSession.schema.path('jti').instance, 'String');
    assert.equal(RefreshSession.schema.path('expiresAt').instance, 'Date');
  });

  it('ai contract validator accepts deterministic mock response', () => {
    const out = validateGeminiGoldenResponse(createDeterministicGeminiMockResponse());
    assert.equal(out.ok, true);
  });

  it('auth sanity: protected route requires and accepts auth', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    const register = await request(app).post('/api/v1/auth/register').send({
      username: `smk${Date.now()}`,
      email: `smk_${Date.now()}@example.com`,
      password: 'StrongTest123!@#',
    });
    const cookies = register.headers['set-cookie'];
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
    assert.ok(me.body?.data?.user?.username);
  });
});
