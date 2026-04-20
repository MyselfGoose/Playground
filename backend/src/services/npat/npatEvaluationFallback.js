import { NPAT_FIELDS } from '../../games/npat/constants.js';
import { npatEvaluationPayloadSchema, recomputeScoresInPlace } from './npatEvaluationSchema.js';

/**
 * @param {string} letter one uppercase A-Z
 * @param {string} raw
 */
export function normalizeAnswer(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * @param {string} letter
 * @param {string} raw
 */
export function startsWithLetter(letter, raw) {
  const L = letter.toUpperCase();
  const t = String(raw ?? '').trim();
  if (!t) return false;
  const first = t[0];
  if (!first) return false;
  return first.toUpperCase() === L;
}

/**
 * Heuristic NPAT evaluation without AI: letter + non-empty + duplicate detection only.
 *
 * @param {{
 *   roundLetter: string,
 *   players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }>,
 * }} input
 */
export function evaluateNpatRoundFallback(input) {
  const letter = input.roundLetter.trim().toUpperCase().slice(0, 1) || '?';

  /** @type {Record<string, Map<string, string[]>>} category -> normalized -> playerIds */
  const buckets = {
    name: new Map(),
    place: new Map(),
    animal: new Map(),
    thing: new Map(),
  };

  for (const cat of NPAT_FIELDS) {
    for (const p of input.players) {
      const raw = p.answers[cat] ?? '';
      const n = normalizeAnswer(raw);
      if (!n) continue;
      const arr = buckets[cat].get(n) ?? [];
      arr.push(p.playerId);
      buckets[cat].set(n, arr);
    }
  }

  /** @param {string} cat @param {string} playerId @param {string} raw */
  function isDup(cat, playerId, raw) {
    const n = normalizeAnswer(raw);
    if (!n) return false;
    const ids = buckets[cat].get(n) ?? [];
    return ids.length > 1;
  }

  /** @param {string} cat @param {string} playerId @param {string} raw */
  function cell(cat, playerId, raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) {
      return {
        value: '',
        isValid: false,
        isDuplicate: false,
        score: 0,
        comment: 'Missing answer',
      };
    }
    if (!startsWithLetter(letter, trimmed)) {
      return {
        value: trimmed,
        isValid: false,
        isDuplicate: false,
        score: 0,
        comment: `Does not start with ${letter}`,
      };
    }
    const dup = isDup(cat, playerId, trimmed);
    return {
      value: trimmed,
      isValid: true,
      isDuplicate: dup,
      score: dup ? 5 : 10,
      comment: dup
        ? 'Same answer as another player after normalization'
        : 'Passes letter and non-empty checks (category not verified offline)',
    };
  }

  const results = input.players.map((p) => {
    const answers = {
      name: cell('name', p.playerId, p.answers.name),
      place: cell('place', p.playerId, p.answers.place),
      animal: cell('animal', p.playerId, p.answers.animal),
      thing: cell('thing', p.playerId, p.answers.thing),
    };
    const totalScore =
      answers.name.score + answers.place.score + answers.animal.score + answers.thing.score;
    return {
      playerId: p.playerId,
      playerName: p.playerName,
      answers,
      totalScore,
    };
  });

  const payload = { round: letter, results };
  const parsed = npatEvaluationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`fallback payload invalid: ${parsed.error.message}`);
  }
  recomputeScoresInPlace(parsed.data);
  return parsed.data;
}
