import { safeParseFullGamePayload } from './npatGameEvaluationSchema.js';

/**
 * Structure-only validator for deterministic contract checks.
 * @param {string} rawText
 */
export function validateGeminiGoldenResponse(rawText) {
  let json;
  try {
    json = JSON.parse(String(rawText));
  } catch (err) {
    return { ok: false, reason: 'invalid_json', error: err instanceof Error ? err.message : String(err) };
  }
  const parsed = safeParseFullGamePayload(json);
  if (!parsed.ok) {
    return { ok: false, reason: 'schema_invalid', error: parsed.error.message };
  }
  for (const round of parsed.data.rounds) {
    for (const row of round.results) {
      if (!row.playerId || !row.playerName) {
        return { ok: false, reason: 'missing_player_fields', error: 'playerId/playerName required' };
      }
      for (const key of ['name', 'place', 'animal', 'thing']) {
        const cell = row.answers[key];
        if (cell.value == null || cell.comment == null) {
          return { ok: false, reason: 'null_cell_value', error: `null in ${key}` };
        }
      }
    }
  }
  return { ok: true };
}
