import { evaluateNpatRoundFallback } from './npatEvaluationFallback.js';
import { runNpatEvaluation } from '../ai/npatEvaluationService.js';

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ roundLetter: string, language?: string, players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }> }} input
 * @param {import('pino').Logger} logger
 * @returns {Promise<{ source: 'gemini' | 'fallback', payload: Record<string, unknown> }>}
 */
export async function evaluateNpatRound(env, input, logger) {
  const result = await runNpatEvaluation(
    env,
    {
      language: input.language,
      rounds: [
        {
          roundIndex: 0,
          roundLetter: input.roundLetter,
          players: input.players,
        },
      ],
    },
    logger,
    { mode: 'background' },
  );
  if (result.source === 'gemini') {
    const round = result.payload.rounds[0];
    return {
      source: 'gemini',
      payload: {
        round: round.round,
        results: round.results,
      },
    };
  }
  return {
    source: 'fallback',
    payload: evaluateNpatRoundFallback({
      roundLetter: input.roundLetter,
      players: input.players,
    }),
  };
}
