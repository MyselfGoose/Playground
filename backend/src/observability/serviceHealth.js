import mongoose from 'mongoose';
import { resolveGeminiApiKeys, resolveGeminiModelChain } from '../services/npat/npatGeminiRouter.js';

/** @type {{
 *   ok: boolean,
 *   checkedAt: string|null,
 *   reason: string|null,
 *   state: string,
 *   activeModel: string|null,
 *   modelChain: string[],
 *   keyCount: number,
 *   lastFailureClass: string|null,
 *   lastProbeModel: string|null,
 * }} */
let aiState = {
  ok: false,
  checkedAt: null,
  reason: 'not_checked',
  state: 'unknown',
  activeModel: null,
  modelChain: [],
  keyCount: 0,
  lastFailureClass: null,
  lastProbeModel: null,
};

/**
 * @param {{
 *   ok: boolean,
 *   reason?: string,
 *   state?: string,
 *   activeModel?: string | null,
 *   modelChain?: string[],
 *   keyCount?: number,
 *   lastFailureClass?: string | null,
 *   lastProbeModel?: string | null,
 * }} next
 */
export function setAiHealth(next) {
  aiState = {
    ok: Boolean(next.ok),
    checkedAt: new Date().toISOString(),
    reason: next.reason ?? (next.ok ? null : 'unknown'),
    state: next.state ?? (next.ok ? 'healthy' : 'degraded_unknown'),
    activeModel: next.activeModel ?? (next.ok ? aiState.activeModel : null),
    modelChain: next.modelChain ?? aiState.modelChain,
    keyCount: next.keyCount ?? aiState.keyCount,
    lastFailureClass: next.lastFailureClass ?? (next.ok ? null : aiState.lastFailureClass),
    lastProbeModel: next.lastProbeModel ?? (next.ok ? next.activeModel ?? null : aiState.lastProbeModel),
  };
}

export function getAiHealth() {
  return { ...aiState };
}

/** @type {Array<{ at: number, source: 'gemini'|'offline_fallback', failureClass: string|null, attemptsUsed: number, latencyMs: number|null }>} */
const npatEvalEvents = [];
const NPAT_EVENT_WINDOW_MS = 10 * 60 * 1000;

function trimNpatEvalEvents(now) {
  const cutoff = now - NPAT_EVENT_WINDOW_MS;
  while (npatEvalEvents.length > 0 && npatEvalEvents[0].at < cutoff) {
    npatEvalEvents.shift();
  }
}

/**
 * @param {{ source: 'gemini'|'offline_fallback', failureClass?: string|null, attemptsUsed?: number, latencyMs?: number|null }} event
 */
export function recordNpatEvaluationEvent(event) {
  const now = Date.now();
  trimNpatEvalEvents(now);
  npatEvalEvents.push({
    at: now,
    source: event.source,
    failureClass: event.failureClass ?? null,
    attemptsUsed: event.attemptsUsed ?? 0,
    latencyMs: event.latencyMs ?? null,
  });
}

export function getNpatEvaluationStats() {
  const now = Date.now();
  trimNpatEvalEvents(now);
  const total = npatEvalEvents.length;
  const fallback = npatEvalEvents.filter((e) => e.source === 'offline_fallback').length;
  const gemini = total - fallback;
  const fallbackRate = total > 0 ? fallback / total : 0;
  return {
    windowMs: NPAT_EVENT_WINDOW_MS,
    total,
    gemini,
    fallback,
    fallbackRate,
    alerts: {
      fallbackRateHigh: total >= 10 && fallbackRate >= 0.2,
      repeatedAuthOrQuotaFailures:
        npatEvalEvents.filter((e) => e.failureClass === 'auth' || e.failureClass === 'quota').length >= 3,
    },
  };
}

/**
 * @param {import('../config/env.js').Env} env
 */
export function isGeminiConfigured(env) {
  if (env.GEMINI_MOCK_MODE) return true;
  return resolveGeminiApiKeys(env).length > 0;
}

/**
 * @param {import('../config/env.js').Env} env
 */
export function getAggregatedHealth(env) {
  const db = mongoose.connection.readyState === 1;
  const auth = Boolean(env.JWT_ACCESS_SECRET?.trim() && env.JWT_REFRESH_SECRET?.trim());
  const geminiConfigured = isGeminiConfigured(env);
  const aiHealthy = !geminiConfigured || getAiHealth().ok;
  const services = { db, ai: aiHealthy, auth };
  const all = Object.values(services);
  const status = all.every(Boolean) ? 'ok' : all.some(Boolean) ? 'degraded' : 'fail';
  return { status, services };
}

/**
 * @param {import('../config/env.js').Env} env
 */
export function syncAiHealthConfigFromEnv(env) {
  const current = getAiHealth();
  setAiHealth({
    ok: current.ok,
    reason: current.reason ?? undefined,
    state: current.state,
    activeModel: current.activeModel,
    modelChain: resolveGeminiModelChain(env),
    keyCount: resolveGeminiApiKeys(env).length,
    lastFailureClass: current.lastFailureClass,
    lastProbeModel: current.lastProbeModel,
  });
}
