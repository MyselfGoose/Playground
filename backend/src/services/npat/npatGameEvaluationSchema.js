import { z } from 'zod';
import { extractRoundLetter, npatPlayerEvalSchema, recomputeScoresInPlace } from './npatEvaluationSchema.js';

const roundLetterField = z.preprocess((v) => extractRoundLetter(v), z.string().min(1).max(1));

export const npatBatchRoundSchema = z.object({
  roundIndex: z.coerce.number().int(),
  round: roundLetterField,
  results: z.array(npatPlayerEvalSchema),
});

export const npatFullGameEvaluationPayloadSchema = z.object({
  rounds: z.array(npatBatchRoundSchema),
});

/**
 * Recompute scores for each round in a batch payload.
 * @param {z.infer<typeof npatFullGameEvaluationPayloadSchema>} payload
 */
export function recomputeFullGameScoresInPlace(payload) {
  for (const r of payload.rounds) {
    recomputeScoresInPlace({ round: r.round, results: r.results });
  }
  return payload;
}

/**
 * @param {unknown} raw
 */
export function safeParseFullGamePayload(raw) {
  const parsed = npatFullGameEvaluationPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: new Error(parsed.error.message) };
  }
  recomputeFullGameScoresInPlace(parsed.data);
  return { ok: true, data: parsed.data };
}
