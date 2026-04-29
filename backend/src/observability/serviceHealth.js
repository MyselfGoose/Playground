import mongoose from 'mongoose';

/** @type {{ ok: boolean, checkedAt: string|null, reason: string|null }} */
let aiState = {
  ok: false,
  checkedAt: null,
  reason: 'not_checked',
};

/**
 * @param {{ ok: boolean, reason?: string }} next
 */
export function setAiHealth(next) {
  aiState = {
    ok: Boolean(next.ok),
    checkedAt: new Date().toISOString(),
    reason: next.reason ?? (next.ok ? null : 'unknown'),
  };
}

export function getAiHealth() {
  return { ...aiState };
}

/**
 * @param {import('../config/env.js').Env} env
 */
export function getAggregatedHealth(env) {
  const db = mongoose.connection.readyState === 1;
  const ai = getAiHealth().ok || !env.GEMINI_API_KEY?.trim() ? !env.GEMINI_API_KEY?.trim() || getAiHealth().ok : false;
  const auth = Boolean(env.JWT_ACCESS_SECRET?.trim() && env.JWT_REFRESH_SECRET?.trim());
  const services = { db, ai, auth };
  const all = Object.values(services);
  const status = all.every(Boolean) ? 'ok' : all.some(Boolean) ? 'degraded' : 'fail';
  return { status, services };
}
