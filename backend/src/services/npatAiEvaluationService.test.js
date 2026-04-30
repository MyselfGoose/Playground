import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { classifyFailure, evaluateNpatFullGameWithStrictService } from './ai/npatEvaluationService.js';
import {
  clearNpatGenerativeModelOverrideForTests,
  setNpatGenerativeModelOverrideForTests,
} from './npat/npatGeminiModel.js';

const baseEnv = {
  GEMINI_API_KEY: 'test-key-abcdefghijklmnopqrstuvwxyz',
  NPAT_EVAL_INTERACTIVE_TIMEOUT_MS: 50,
  NPAT_EVAL_INTERACTIVE_MAX_RETRIES: 0,
  NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS: 1024,
  NPAT_EVAL_TIMEOUT_MS: 50,
  NPAT_EVAL_MAX_RETRIES: 1,
  NPAT_EVAL_MAX_OUTPUT_TOKENS: 1024,
  NPAT_EVAL_MAX_ANSWER_CHARS: 120,
};

const logger = { info() {}, warn() {}, error() {}, debug() {} };

function buildEngine() {
  return {
    code: 'T123',
    players: new Map([
      ['u1', { username: 'Alice' }],
      ['u2', { username: 'Bob' }],
    ]),
    results: {
      rounds: [
        {
          roundIndex: 0,
          letter: 'A',
          submissions: {
            u1: { name: 'Amy', place: 'Athens', animal: 'Ant', thing: 'Arrow' },
            u2: { name: 'Alan', place: 'Ankara', animal: 'Ape', thing: 'Anchor' },
          },
        },
      ],
    },
  };
}

afterEach(() => {
  clearNpatGenerativeModelOverrideForTests();
});

describe('npatEvaluationService', () => {
  it('maps failure taxonomy classes deterministically', () => {
    assert.equal(classifyFailure(new Error('timeout exceeded')), 'timeout');
    assert.equal(classifyFailure(new Error('rate limit exceeded')), 'rate_limit');
    assert.equal(classifyFailure(new Error('quota exhausted')), 'quota');
    assert.equal(classifyFailure(new Error('api key invalid')), 'auth');
    assert.equal(classifyFailure(new Error('json parse failed')), 'parse_error');
    assert.equal(classifyFailure(new Error('schema_error: missing field')), 'schema_error');
    assert.equal(classifyFailure(new Error('integrity_error: missing_player')), 'integrity_error');
    assert.equal(classifyFailure(new Error('unknown upstream failure')), 'provider_error');
  });

  it('returns offline fallback with integrity_error when player coverage is incomplete', async () => {
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => ({
        response: {
          text: () =>
            JSON.stringify({
              rounds: [
                {
                  roundIndex: 0,
                  round: 'A',
                  results: [
                    {
                      playerId: 'u1',
                      playerName: 'Alice',
                      answers: {
                        name: { value: 'Amy', isValid: true, isDuplicate: false, score: 10, comment: 'ok' },
                        place: { value: 'Athens', isValid: true, isDuplicate: false, score: 10, comment: 'ok' },
                        animal: { value: 'Ant', isValid: true, isDuplicate: false, score: 10, comment: 'ok' },
                        thing: { value: 'Arrow', isValid: true, isDuplicate: false, score: 10, comment: 'ok' },
                      },
                      totalScore: 40,
                    },
                  ],
                },
              ],
            }),
        },
      }),
    }));
    const out = await evaluateNpatFullGameWithStrictService(baseEnv, buildEngine(), logger, {
      mode: 'interactive',
    });
    assert.equal(out.source, 'offline_fallback');
    assert.equal(out.failureClass, 'integrity_error');
    assert.equal(out.attemptsUsed, 1);
  });

  it('retries then falls back with rate_limit classification', async () => {
    let attempts = 0;
    setNpatGenerativeModelOverrideForTests(() => ({
      generateContent: async () => {
        attempts += 1;
        throw new Error('rate limit exceeded');
      },
    }));
    const out = await evaluateNpatFullGameWithStrictService(
      { ...baseEnv, NPAT_EVAL_MAX_RETRIES: 2 },
      buildEngine(),
      logger,
      { mode: 'background' },
    );
    assert.equal(out.source, 'offline_fallback');
    assert.equal(out.failureClass, 'rate_limit');
    assert.equal(out.attemptsUsed, 3);
    assert.equal(attempts, 3);
  });
});
