/**
 * Estimates Gemini maxOutputTokens from NPAT batch size to reduce truncated JSON failures.
 */

const PER_CELL_BUDGET = 80;
const BASE_TOKENS = 512;
const INTERACTIVE_FLOOR = 4096;

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ rounds: Array<{ players: Array<unknown> }> }} input
 * @param {'interactive' | 'background'} mode
 */
export function estimateNpatEvalMaxOutputTokens(env, input, mode) {
  const roundCount = input.rounds.length;
  let maxPlayers = 0;
  for (const round of input.rounds) {
    maxPlayers = Math.max(maxPlayers, round.players?.length ?? 0);
  }
  const cellCount = Math.max(1, roundCount * Math.max(1, maxPlayers) * 4);
  const estimated = BASE_TOKENS + cellCount * PER_CELL_BUDGET;

  if (mode === 'interactive') {
    const cap = env.NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS;
    const floor = Math.min(INTERACTIVE_FLOOR, cap);
    return Math.min(cap, Math.max(floor, estimated));
  }

  const cap = env.NPAT_EVAL_MAX_OUTPUT_TOKENS;
  return Math.min(cap, Math.max(2048, estimated));
}
