import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { applyTestEnv } from '../../support/testEnv.js';
import { createTestApp } from '../../support/appFactory.js';
import { setAiHealth } from '../../../backend/src/observability/serviceHealth.js';

describe('GET /health', () => {
  /** @type {import('express').Express} */
  let app;

  before(() => {
    const env = applyTestEnv();
    setAiHealth({ ok: true });
    app = createTestApp({ env });
  });

  it('returns aggregate health payload', async () => {
    const res = await request(app).get('/health').expect(200);
    assert.equal(typeof res.body.status, 'string');
    assert.equal(typeof res.body.services, 'object');
    assert.equal(typeof res.body.services.db, 'boolean');
    assert.equal(typeof res.body.services.ai, 'boolean');
    assert.equal(typeof res.body.services.auth, 'boolean');
    assert.equal(typeof res.body.ai, 'object');
    assert.equal(typeof res.body.ai.state, 'string');
    assert.equal(typeof res.body.npatEvaluation, 'object');
    assert.equal(typeof res.body.npatEvaluation.fallbackRate, 'number');
    assert.equal(typeof res.body.npatEvaluation.alerts, 'object');
    assert.ok(['ok', 'degraded', 'fail'].includes(res.body.status));
    assert.equal(res.body.ok, res.body.status !== 'fail');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(typeof res.body.version === 'string', 'expected package version in body');
  });
});
