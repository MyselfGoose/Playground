import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluateNpatFullGame } from '../../../backend/src/services/npat/npatGameEvaluationService.js';
import { evaluateNpatFullGameWithStrictService } from '../../../backend/src/services/ai/npatEvaluationService.js';
import {
  setNpatGenerativeModelOverrideForTests,
  clearNpatGenerativeModelOverrideForTests,
  createDeterministicGeminiMockResponse,
} from '../../../backend/src/services/npat/npatGeminiModel.js';
import { applyTestEnv } from '../../support/testEnv.js';
import { createSilentLogger } from '../../support/silentLogger.js';
import { validateGeminiGoldenResponse } from '../../../backend/src/services/npat/npatGeminiContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '../../fixtures/npat-gemini-batch-minimal.json');

function minimalEngine() {
  return {
    players: new Map([['u1', { username: 'Alice' }]]),
    results: {
      rounds: [
        {
          roundIndex: 0,
          letter: 'A',
          submissions: {
            u1: { name: 'Amy', place: 'Austin', animal: 'Ant', thing: 'Apple' },
          },
        },
      ],
    },
  };
}

describe('NPAT Gemini evaluation (mocked)', () => {
  const logger = createSilentLogger();

  after(() => {
    clearNpatGenerativeModelOverrideForTests();
  });

  it('returns gemini source when mock returns valid JSON', async () => {
    const jsonText = readFileSync(fixturePath, 'utf8');
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => ({
        response: {
          text: () => jsonText,
        },
      }),
    }));

    const env = applyTestEnv({ GEMINI_API_KEY: 'test-key-not-used' });
    const out = await evaluateNpatFullGame(env, minimalEngine(), logger);

    assert.equal(out.source, 'gemini');
    assert.equal(out.payload.rounds.length, 1);
    assert.equal(out.payload.rounds[0].results[0].playerId, 'u1');
  });

  it('validates deterministic golden mock response structure', () => {
    const result = validateGeminiGoldenResponse(createDeterministicGeminiMockResponse());
    assert.equal(result.ok, true);
  });

  it('falls back when mock returns invalid JSON', async () => {
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => ({
        response: {
          text: () => 'not-json',
        },
      }),
    }));

    const env = applyTestEnv({ GEMINI_API_KEY: 'test-key-not-used' });
    const out = await evaluateNpatFullGame(env, minimalEngine(), logger);

    assert.equal(out.source, 'fallback');
    assert.ok(out.payload.rounds[0].results.length >= 1);
  });

  it('falls back after timeout + retry exhaustion', async () => {
    let attempts = 0;
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => {
        attempts += 1;
        throw new Error('simulated upstream timeout');
      },
    }));
    const env = applyTestEnv({
      GEMINI_API_KEY: 'test-key-not-used',
      NPAT_EVAL_INTERACTIVE_MAX_RETRIES: '1',
    });
    const out = await evaluateNpatFullGame(env, minimalEngine(), logger);
    assert.equal(out.source, 'fallback');
    assert.equal(attempts, 2);
  });

  it('uses strict offline fallback metadata on malformed schema payload', async () => {
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({ rounds: [{ roundIndex: 0, round: 'A' }] }),
        },
      }),
    }));
    const env = applyTestEnv({
      GEMINI_API_KEY: 'test-key-not-used',
      NPAT_EVAL_INTERACTIVE_MAX_RETRIES: '0',
    });
    const out = await evaluateNpatFullGameWithStrictService(env, minimalEngine(), logger, { mode: 'interactive' });
    assert.equal(out.source, 'offline_fallback');
    assert.equal(out.failureClass, 'schema_error');
    assert.equal(out.attemptsUsed, 1);
    assert.equal(out.payload.rounds.length, 1);
  });

  it('maps provider rate errors and retries before fallback', async () => {
    let attempts = 0;
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => {
        attempts += 1;
        throw new Error('rate limit exceeded');
      },
    }));
    const env = applyTestEnv({
      GEMINI_API_KEY: 'test-key-not-used',
      NPAT_EVAL_INTERACTIVE_MAX_RETRIES: '1',
    });
    const out = await evaluateNpatFullGameWithStrictService(env, minimalEngine(), logger, { mode: 'interactive' });
    assert.equal(out.source, 'offline_fallback');
    assert.equal(out.failureClass, 'rate_limit');
    assert.equal(out.attemptsUsed, 2);
    assert.equal(attempts, 2);
  });
});
