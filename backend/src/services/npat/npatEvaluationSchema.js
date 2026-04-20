import { z } from 'zod';

const FIELDS = ['name', 'place', 'animal', 'thing'];

export const npatAnswerCellSchema = z.object({
  value: z.string(),
  isValid: z.boolean(),
  isDuplicate: z.boolean(),
  score: z.number().int(),
  comment: z.string(),
});

export const npatPlayerEvalSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  answers: z.object({
    name: npatAnswerCellSchema,
    place: npatAnswerCellSchema,
    animal: npatAnswerCellSchema,
    thing: npatAnswerCellSchema,
  }),
  totalScore: z.number().int(),
});

export const npatEvaluationPayloadSchema = z.object({
  round: z.string().min(1).max(4),
  results: z.array(npatPlayerEvalSchema),
});

/**
 * Deterministic scoring from validity flags (10 / 5 / 0).
 * @param {z.infer<typeof npatAnswerCellSchema>} cell
 */
export function scoreFromFlags(cell) {
  if (!cell.isValid) return 0;
  return cell.isDuplicate ? 5 : 10;
}

/**
 * Overwrite per-cell scores and recompute totalScore per player.
 * @param {z.infer<typeof npatEvaluationPayloadSchema>} payload
 */
export function recomputeScoresInPlace(payload) {
  for (const row of payload.results) {
    let total = 0;
    for (const k of FIELDS) {
      const c = row.answers[/** @type {'name'|'place'|'animal'|'thing'} */ (k)];
      const s = scoreFromFlags(c);
      c.score = s;
      total += s;
    }
    row.totalScore = total;
  }
  return payload;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: z.infer<typeof npatEvaluationPayloadSchema> } | { ok: false, error: Error }}
 */
export function safeParseEvaluationPayload(raw) {
  const parsed = npatEvaluationPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: new Error(parsed.error.message),
    };
  }
  recomputeScoresInPlace(parsed.data);
  return { ok: true, data: parsed.data };
}
