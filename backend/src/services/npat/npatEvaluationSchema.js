import { z } from 'zod';

const FIELDS = ['name', 'place', 'animal', 'thing'];

/**
 * Normalize model `round` strings ("Round B", "Letter B") to a single A–Z letter.
 * @param {unknown} v
 */
export function extractRoundLetter(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return '';
  if (/^[A-Z]$/.test(s)) return s;
  const parts = s.split(/[^A-Z]+/).filter((p) => p.length > 0);
  const oneChar = parts.filter((p) => p.length === 1);
  if (oneChar.length > 0) return oneChar[oneChar.length - 1];
  const all = s.match(/[A-Z]/g);
  return all && all.length > 0 ? all[all.length - 1] : '';
}

/** Gemini JSON mode occasionally omits null vs string; coerce for stable parsing. */
const jsonString = z.preprocess((v) => (v == null ? '' : String(v)), z.string());

const jsonBool = z.preprocess((v) => {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return v;
}, z.boolean());

export const npatAnswerCellSchema = z.object({
  value: jsonString,
  isValid: jsonBool,
  isDuplicate: jsonBool,
  score: z.coerce.number().int(),
  comment: jsonString,
});

export const npatPlayerEvalSchema = z.object({
  playerId: z.coerce.string(),
  playerName: jsonString,
  answers: z.object({
    name: npatAnswerCellSchema,
    place: npatAnswerCellSchema,
    animal: npatAnswerCellSchema,
    thing: npatAnswerCellSchema,
  }),
  totalScore: z.coerce.number().int(),
});

export const npatEvaluationPayloadSchema = z.object({
  round: z.preprocess((v) => extractRoundLetter(v), z.string().min(1).max(1)),
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
