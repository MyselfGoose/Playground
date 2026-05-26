/**
 * Resolves Gemini API keys and model failover chains from env.
 */

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseCsvEnv(raw) {
  if (!raw?.trim()) return [];
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * @param {import('../../config/env.js').Env} env
 * @returns {string[]}
 */
export function resolveGeminiApiKeys(env) {
  const keys = [];
  const seen = new Set();
  for (const key of [env.GEMINI_API_KEY, ...parseCsvEnv(env.GEMINI_API_KEY_FALLBACKS)]) {
    const trimmed = key?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    keys.push(trimmed);
  }
  return keys;
}

/**
 * @param {import('../../config/env.js').Env} env
 * @returns {string[]}
 */
export function resolveGeminiModelChain(env) {
  const blocklist = new Set(parseCsvEnv(env.GEMINI_MODEL_BLOCKLIST));
  const chain = [];
  const seen = new Set();
  for (const modelId of [env.GEMINI_MODEL, ...parseCsvEnv(env.GEMINI_MODEL_FALLBACKS)]) {
    const trimmed = String(modelId ?? '').trim();
    if (!trimmed || seen.has(trimmed) || blocklist.has(trimmed)) continue;
    seen.add(trimmed);
    chain.push(trimmed);
  }
  return chain;
}

/** @param {string | null | undefined} failureClass */
export function isImmediatelyFatalFailure(failureClass) {
  return failureClass === 'auth' || failureClass === 'model_not_found' || failureClass === 'invalid_model';
}

/** @param {string | null | undefined} failureClass */
export function shouldRetrySameModel(failureClass) {
  if (!failureClass) return true;
  return !isImmediatelyFatalFailure(failureClass);
}
