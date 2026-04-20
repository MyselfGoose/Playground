import { GoogleGenerativeAI } from '@google/generative-ai';
import { evaluateNpatRoundFallback } from './npatEvaluationFallback.js';
import { safeParseEvaluationPayload } from './npatEvaluationSchema.js';

const SYSTEM_PROMPT = `You are an expert judge for the game "Name, Place, Animal, Thing" (NPAT).

Rules:
- A round has a single letter (e.g. A). Every answer must be a real word or well-known proper noun that STARTS with that letter (first letter, case-insensitive). Trim whitespace.
- Categories:
  - name: A person's first name (real human names; fictional names are allowed if widely known).
  - place: A real or well-known place (city, country, landmark, continent, etc.).
  - animal: A real animal species or well-known animal type (no cars/brands as "animals").
  - thing: A concrete object or tangible item (not abstract concepts unless commonly called a "thing" in everyday speech). Reject answers that clearly belong to another category.
- If an answer is empty or whitespace, it is invalid.
- Typos: minor spelling errors still count as valid if the intended word is obvious and satisfies the letter and category.
- Duplicates: Two players have a DUPLICATE in the same category if their answers match after normalization: trim, lowercase, collapse internal spaces. Synonyms or translations are NOT duplicates unless the normalized text is identical.
- Scoring (you must set flags; the server may recompute points from flags):
  - Unique valid answer: isValid=true, isDuplicate=false → score 10
  - Valid but duplicate: isValid=true, isDuplicate=true → score 5
  - Invalid or missing: isValid=false → score 0

Output requirements:
- Respond with JSON ONLY. No markdown, no code fences, no commentary outside JSON.
- The JSON must match this structure exactly:
{
  "round": "<single letter>",
  "results": [
    {
      "playerId": "<string>",
      "playerName": "<string>",
      "answers": {
        "name": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
        "place": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
        "animal": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
        "thing": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" }
      },
      "totalScore": 0
    }
  ]
}
- Include EVERY player from INPUT_JSON exactly once; use the same playerId and playerName as provided.
- Each "comment" is ONE short English sentence explaining the decision for that cell.
- Use "value" as the trimmed answer text (empty string if missing).`;

/**
 * @param {string} text
 */
function stripJsonFence(text) {
  let t = String(text).trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return t.trim();
}

/**
 * @param {import('../../config/env.js').Env} env
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ roundLetter: string, language?: string, players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }> }} input
 * @param {import('pino').Logger} logger
 */
async function callGemini(env, input, logger) {
  const key = env.GEMINI_API_KEY;
  if (!key?.trim()) {
    throw new Error('GEMINI_API_KEY missing');
  }
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
  const capped = {
    ...input,
    players: input.players.map((p) => ({
      ...p,
      answers: {
        name: cap(p.answers.name, env.NPAT_EVAL_MAX_ANSWER_CHARS),
        place: cap(p.answers.place, env.NPAT_EVAL_MAX_ANSWER_CHARS),
        animal: cap(p.answers.animal, env.NPAT_EVAL_MAX_ANSWER_CHARS),
        thing: cap(p.answers.thing, env.NPAT_EVAL_MAX_ANSWER_CHARS),
      },
    })),
  };
  const userJson = JSON.stringify(capped);
  const prompt = `${SYSTEM_PROMPT}\n\nINPUT_JSON:\n${userJson}`;

  const run = async () => {
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    return stripJsonFence(text);
  };

  const timeoutMs = env.NPAT_EVAL_TIMEOUT_MS;
  const out = await Promise.race([
    run(),
    new Promise((_, rej) => {
      setTimeout(() => rej(new Error('Gemini request timeout')), timeoutMs);
    }),
  ]);
  return /** @type {string} */ (out);
}

/**
 * @param {string | undefined} s
 * @param {number} max
 */
function cap(s, max) {
  const t = String(s ?? '');
  if (t.length <= max) return t;
  return t.slice(0, max);
}

/**
 * @param {{ results: Array<{ playerId: string }> }} payload
 * @param {Set<string>} expectedIds
 */
function resultsCoverAllPlayers(payload, expectedIds) {
  const got = new Set(payload.results.map((r) => r.playerId));
  if (got.size !== expectedIds.size) return false;
  for (const id of expectedIds) {
    if (!got.has(id)) return false;
  }
  return true;
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ roundLetter: string, language?: string, players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }> }} input
 * @param {import('pino').Logger} logger
 * @returns {Promise<{ source: 'gemini' | 'fallback', payload: Record<string, unknown> }>}
 */
export async function evaluateNpatRound(env, input, logger) {
  const expectedIds = new Set(input.players.map((p) => p.playerId));
  const fallback = () => ({
    source: /** @type {const} */ ('fallback'),
    payload: evaluateNpatRoundFallback({
      roundLetter: input.roundLetter,
      players: input.players,
    }),
  });

  if (!env.GEMINI_API_KEY?.trim()) {
    logger.info({ event: 'npat_eval_no_api_key' }, 'npat_eval');
    return fallback();
  }

  let lastErr = /** @type {Error | null} */ (null);
  const attempts = env.NPAT_EVAL_MAX_RETRIES + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const rawText = await callGemini(env, input, logger);
      const json = JSON.parse(rawText);
      const parsed = safeParseEvaluationPayload(json);
      if (!parsed.ok) {
        lastErr = parsed.error;
        logger.warn({ err: parsed.error, attempt }, 'npat_eval_parse');
      } else if (!resultsCoverAllPlayers(parsed.data, expectedIds)) {
        lastErr = new Error('Gemini result missing players');
        logger.warn({ attempt }, 'npat_eval_incomplete_players');
      } else {
        return { source: 'gemini', payload: parsed.data };
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      logger.warn({ err: lastErr, attempt }, 'npat_eval_gemini');
    }
    if (attempt < attempts - 1) {
      await sleep(250 * (attempt + 1));
    }
  }

  if (lastErr) {
    logger.warn({ err: lastErr }, 'npat_eval_using_fallback');
  }
  return fallback();
}
