import { buildNpatEvaluationInput } from './npatEvaluationInput.js';
import { evaluateNpatRoundFallback } from './npatEvaluationFallback.js';
import { evaluateNpatFullGameWithStrictService } from '../ai/npatEvaluationService.js';

/**
 * @param {{
 *   results: { rounds: Array<{ roundIndex: number }> },
 *   players: Map<string, { username?: string }>,
 * }} engine
 */
export function evaluateNpatFullGameFallback(engine) {
  /** @type {Array<{ roundIndex: number, round: string, results: unknown[] }>} */
  const rounds = [];
  for (const r of engine.results.rounds) {
    const input = buildNpatEvaluationInput(engine, r.roundIndex);
    const payload = evaluateNpatRoundFallback({
      roundLetter: input.roundLetter,
      players: input.players,
    });
    rounds.push({
      roundIndex: r.roundIndex,
      round: payload.round,
      results: payload.results,
    });
  }
  return { rounds };
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ results: { rounds: Array<{ roundIndex: number }> }, players: Map<string, unknown> }} engine
 * @param {import('pino').Logger} logger
 * @param {{ mode?: 'interactive'|'background' }} [options]
 * @returns {Promise<{ source: 'gemini' | 'fallback', payload: { rounds: Array<{ roundIndex: number, round: string, results: unknown[] }> } }>}
 */
export async function evaluateNpatFullGame(env, engine, logger, options = {}) {
  const result = await evaluateNpatFullGameWithStrictService(env, engine, logger, options);
  return {
    source: result.source === 'offline_fallback' ? 'fallback' : 'gemini',
    payload: result.payload,
  };
}
