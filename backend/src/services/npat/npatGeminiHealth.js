import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../../config/env.js';
import { createDeterministicGeminiMockResponse } from './npatGeminiModel.js';
import { validateGeminiGoldenResponse } from './npatGeminiContract.js';
import { setAiHealth } from '../../observability/serviceHealth.js';
import { evaluateNpatFullGame } from './npatGameEvaluationService.js';

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

export async function runGeminiHealthCheck() {
  const env = getEnv();
  const keyCheck = validateApiKey(env);
  if (!keyCheck.ok) {
    setAiHealth({ ok: false, reason: keyCheck.reason });
    return { ok: false, reason: keyCheck.reason };
  }

  try {
    if (env.GEMINI_MOCK_MODE) {
      const valid = validateGeminiGoldenResponse(createDeterministicGeminiMockResponse());
      if (!valid.ok) {
        setAiHealth({ ok: false, reason: valid.reason });
        return { ok: false, reason: valid.reason, error: valid.error };
      }
      setAiHealth({ ok: true });
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
    const result = await evaluateNpatFullGame(env, probeEngine, logger);
    if (result.source !== 'gemini') {
      setAiHealth({ ok: false, reason: 'gemini_pipeline_fallback' });
      return { ok: false, reason: 'gemini_pipeline_fallback' };
    }

    setAiHealth({ ok: true });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    setAiHealth({ ok: false, reason: 'gemini_unreachable' });
    return { ok: false, reason: 'gemini_unreachable', error: reason };
  }
}
