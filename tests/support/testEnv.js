import { getEnv, resetEnvCacheForTests } from '../../backend/src/config/env.js';

/**
 * Apply minimal safe env for HTTP integration tests and re-parse config.
 * Call `resetEnvCacheForTests()` first or use `applyTestEnv` which does both.
 *
 * @param {Record<string, string | undefined>} [overrides]
 */
export function applyTestEnv(overrides = {}) {
  process.env.NODE_ENV = 'test';
  resetEnvCacheForTests();
  const base = {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test_access_secret_32_chars_min_!!',
    JWT_REFRESH_SECRET: 'test_refresh_secret_32_chars_min!!',
    CORS_ORIGIN: 'http://127.0.0.1:3000',
    TRUST_PROXY: '0',
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return getEnv();
}
