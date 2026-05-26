import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../../config/env.js';
import { createDeterministicGeminiMockResponse } from './npatGeminiModel.js';
import { validateGeminiGoldenResponse } from './npatGeminiContract.js';
import { setAiHealth, syncAiHealthConfigFromEnv } from '../../observability/serviceHealth.js';
import { evaluateNpatFullGameWithStrictService } from '../ai/npatEvaluationService.js';
import { resolveGeminiApiKeys, resolveGeminiModelChain } from './npatGeminiRouter.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

/**
 * @param {import('../../config/env.js').Env} env
 */
function validateApiKey(env) {
  if (env.GEMINI_MOCK_MODE) return { ok: true };
  const keys = resolveGeminiApiKeys(env);
  if (keys.length === 0) return { ok: false, reason: 'missing_api_key' };
  if (keys.some((k) => k.length < 20)) return { ok: false, reason: 'invalid_api_key_format' };
  return { ok: true };
}

function reasonToState(reason) {
  if (!reason) return 'degraded_unknown';
  if (reason.includes('rate_limit')) return 'degraded_provider_rate_limited';
  if (reason.includes('quota')) return 'degraded_quota';
  if (reason.includes('auth') || reason.includes('api_key')) return 'degraded_auth';
  if (reason.includes('model_not_found') || reason.includes('invalid_model')) return 'degraded_model';
  if (reason === 'healthy') return 'healthy';
  return 'degraded_unknown';
}

export async function runGeminiHealthCheck() {
  const env = getEnv();
  const modelChain = resolveGeminiModelChain(env);
  const keyCount = resolveGeminiApiKeys(env).length;

  syncAiHealthConfigFromEnv(env);

  const keyCheck = validateApiKey(env);
  if (!keyCheck.ok) {
    setAiHealth({
      ok: false,
      reason: keyCheck.reason,
      state: reasonToState(keyCheck.reason),
      modelChain,
      keyCount,
      lastFailureClass: 'auth',
    });
    return { ok: false, reason: keyCheck.reason };
  }

  if (modelChain.length === 0) {
    setAiHealth({
      ok: false,
      reason: 'invalid_model_chain',
      state: reasonToState('invalid_model'),
      modelChain,
      keyCount,
      lastFailureClass: 'invalid_model',
    });
    return { ok: false, reason: 'invalid_model_chain' };
  }

  try {
    if (env.GEMINI_MOCK_MODE) {
      const valid = validateGeminiGoldenResponse(createDeterministicGeminiMockResponse());
      if (!valid.ok) {
        setAiHealth({
          ok: false,
          reason: valid.reason,
          state: reasonToState(valid.reason),
          modelChain,
          keyCount,
        });
        return { ok: false, reason: valid.reason, error: valid.error };
      }
      setAiHealth({
        ok: true,
        state: 'healthy',
        activeModel: modelChain[0] ?? null,
        modelChain,
        keyCount,
        lastFailureClass: null,
        lastProbeModel: modelChain[0] ?? null,
      });
      return { ok: true, mode: 'mock' };
    }

    const probeEngine = {
      players: new Map([
        ['probe-u1', { username: 'ProbeOne' }],
        ['probe-u2', { username: 'ProbeTwo' }],
      ]),
      results: {
        rounds: [
          {
            roundIndex: 0,
            letter: 'A',
            submissions: {
              'probe-u1': { name: 'Amy', place: 'Athens', animal: 'Ant', thing: 'Arrow' },
              'probe-u2': { name: 'Adam', place: 'Ankara', animal: 'Ape', thing: 'Anchor' },
            },
          },
        ],
      },
    };
    const logger = { info() {}, warn() {}, error() {}, debug() {} };
    const result = await evaluateNpatFullGameWithStrictService(env, probeEngine, logger, {
      mode: 'background',
    });
    if (result.source !== 'gemini') {
      const reason = `gemini_pipeline_${result.failureClass ?? 'fallback'}`;
      setAiHealth({
        ok: false,
        reason,
        state: reasonToState(reason),
        modelChain,
        keyCount,
        lastFailureClass: result.failureClass ?? 'provider_error',
      });
      return { ok: false, reason, attemptsUsed: result.attemptsUsed };
    }

    setAiHealth({
      ok: true,
      state: 'healthy',
      activeModel: result.modelUsed ?? modelChain[0] ?? null,
      modelChain,
      keyCount,
      lastFailureClass: null,
      lastProbeModel: result.modelUsed ?? modelChain[0] ?? null,
    });
    return { ok: true, modelUsed: result.modelUsed ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    setAiHealth({
      ok: false,
      reason: 'gemini_unreachable',
      state: 'degraded_unknown',
      modelChain,
      keyCount,
      lastFailureClass: 'provider_error',
    });
    return { ok: false, reason: 'gemini_unreachable', error: reason };
  }
}
