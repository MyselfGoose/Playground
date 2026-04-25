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

describe('Feedback API', () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    await startMongoMemoryServer();
    const env = applyTestEnv({
      FEEDBACK_ENABLED: 'true',
      GITHUB_TOKEN: '',
      GITHUB_OWNER: '',
      GITHUB_REPO: '',
    });
    app = createTestApp({ env });
    await connectMongoose();
    await dropAllCollections();
  });

  after(async () => {
    await stopMongoMemoryServer();
  });

  it('POST /api/v1/feedback returns 503 when GitHub is not configured', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({
        type: 'bug',
        message: 'Integration test feedback body',
      })
      .expect(503);

    assert.ok(String(res.body?.error?.message || '').length > 0);
  });
});
