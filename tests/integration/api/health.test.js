import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applyTestEnv } from '../../support/testEnv.js';
import { createTestApp } from '../../support/appFactory.js';

describe('GET /health', () => {
  /** @type {import('express').Express} */
  let app;

  before(() => {
    const env = applyTestEnv();
    app = createTestApp({ env });
  });

  it('returns 200 with ok and version fields', async () => {
    const res = await request(app).get('/health').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(typeof res.body.version === 'string', 'expected package version in body');
  });
});
