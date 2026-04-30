import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../../config/env.js';
import { createDeterministicGeminiMockResponse } from './npatGeminiModel.js';
import { validateGeminiGoldenResponse } from './npatGeminiContract.js';
import { setAiHealth } from '../../observability/serviceHealth.js';
import { evaluateNpatFullGameWithStrictService } from '../ai/npatEvaluationService.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

/**
 * @param {import('../../config/env.js').Env} env
 */
function validateApiKey(env) {
  const key = env.GEMINI_API_KEY?.trim() ?? '';
  if (env.GEMINI_MOCK_MODE) return { ok: true };
  if (!key) return { ok: false, reason: 'missing_api_key' };
  if (key.length < 20) return { ok: false, reason: 'invalid_api_key_format' };
  return { ok: true };
}

function reasonToState(reason) {
  if (!reason) return 'degraded_unknown';
  if (reason.includes('rate_limit')) return 'degraded_provider_rate_limited';
  if (reason.includes('quota')) return 'degraded_quota';
  if (reason.includes('auth') || reason.includes('api_key')) return 'degraded_auth';
  if (reason === 'healthy') return 'healthy';
  return 'degraded_unknown';
}

export async function runGeminiHealthCheck() {
  const env = getEnv();
  const keyCheck = validateApiKey(env);
  if (!keyCheck.ok) {
    setAiHealth({ ok: false, reason: keyCheck.reason, state: reasonToState(keyCheck.reason) });
    return { ok: false, reason: keyCheck.reason };
  }

  try {
    if (env.GEMINI_MOCK_MODE) {
      const valid = validateGeminiGoldenResponse(createDeterministicGeminiMockResponse());
      if (!valid.ok) {
        setAiHealth({ ok: false, reason: valid.reason, state: reasonToState(valid.reason) });
        return { ok: false, reason: valid.reason, error: valid.error };
      }
      setAiHealth({ ok: true, state: 'healthy' });
      return { ok: true, mode: 'mock' };
    }

    // Probe the same runtime path used by live NPAT scoring to avoid false negatives from
    // ad-hoc prompts that do not reflect production schema requirements.
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
      setAiHealth({ ok: false, reason, state: reasonToState(reason) });
      return { ok: false, reason, attemptsUsed: result.attemptsUsed };
    }

    setAiHealth({ ok: true, state: 'healthy' });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    setAiHealth({ ok: false, reason: 'gemini_unreachable', state: 'degraded_unknown' });
    return { ok: false, reason: 'gemini_unreachable', error: reason };
  }
}
