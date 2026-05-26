import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isImmediatelyFatalFailure,
  parseCsvEnv,
  resolveGeminiApiKeys,
  resolveGeminiModelChain,
  shouldRetrySameModel,
} from './npatGeminiRouter.js';

describe('npatGeminiRouter', () => {
  it('parseCsvEnv trims, dedupes, and drops empty', () => {
    assert.deepEqual(parseCsvEnv(' a, b ,a,, '), ['a', 'b']);
  });

  it('resolveGeminiApiKeys returns primary then fallbacks', () => {
    const keys = resolveGeminiApiKeys({
      GEMINI_API_KEY: 'primary-key',
      GEMINI_API_KEY_FALLBACKS: 'backup, primary-key',
    });
    assert.deepEqual(keys, ['primary-key', 'backup']);
  });

  it('resolveGeminiModelChain applies blocklist', () => {
    const chain = resolveGeminiModelChain({
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_MODEL_FALLBACKS: 'gemini-2.5-flash-lite, gemini-2.5-flash',
      GEMINI_MODEL_BLOCKLIST: 'gemini-2.5-flash-lite',
    });
    assert.deepEqual(chain, ['gemini-2.5-flash']);
  });

  it('classifies fatal vs retryable failures', () => {
    assert.equal(isImmediatelyFatalFailure('auth'), true);
    assert.equal(isImmediatelyFatalFailure('model_not_found'), true);
    assert.equal(shouldRetrySameModel('rate_limit'), true);
    assert.equal(shouldRetrySameModel('auth'), false);
  });
});
