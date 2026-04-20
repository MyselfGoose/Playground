import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildNpatEvaluationInput, buildNpatFullGameEvaluationInput } from './npatEvaluationInput.js';
import { evaluateNpatRoundFallback } from './npatEvaluationFallback.js';
import { safeParseFullGamePayload } from './npatGameEvaluationSchema.js';

const BATCH_SYSTEM_PROMPT = `You are an expert judge for the game "Name, Place, Animal, Thing" (NPAT).

You will receive multiple rounds at once. Each round has a roundIndex, a roundLetter, and all players' answers for that round.

Rules (apply independently to EACH round):
- A round has a single letter. Every answer must START with that letter (first letter, case-insensitive). Trim whitespace.
- Categories: name (person's first name), place (real/well-known place), animal (real animal), thing (concrete object).
- Empty answers are invalid.
- Duplicates: same normalized text (trim, lowercase, collapse spaces) in the SAME round and SAME category across players = duplicate (5 pts if valid).
- Scoring: unique valid = 10, duplicate valid = 5, invalid = 0. Set isValid, isDuplicate; server may recompute score from flags.

Output JSON ONLY — no markdown, no code fences. Structure:
{
  "rounds": [
    {
      "roundIndex": 0,
      "round": "A",
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
  ]
}

Include EVERY round from INPUT_JSON. For each round, include EVERY player from that round's player list exactly once.`;

function stripJsonFence(text) {
  let t = String(text).trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return t.trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {string | undefined} s
 * @param {number} max
 */
function cap(s, max) {
  const t = String(s ?? '');
  if (t.length <= max) return t;
  return t.slice(0, max);
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ language?: string, rounds: Array<{ roundIndex: number, roundLetter: string, players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }> }> }} input
 * @param {import('pino').Logger} logger
 */
async function callGeminiFullGame(env, input, logger) {
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
    rounds: input.rounds.map((r) => ({
      ...r,
      players: r.players.map((p) => ({
        ...p,
        answers: {
          name: cap(p.answers.name, env.NPAT_EVAL_MAX_ANSWER_CHARS),
          place: cap(p.answers.place, env.NPAT_EVAL_MAX_ANSWER_CHARS),
          animal: cap(p.answers.animal, env.NPAT_EVAL_MAX_ANSWER_CHARS),
          thing: cap(p.answers.thing, env.NPAT_EVAL_MAX_ANSWER_CHARS),
        },
      })),
    })),
  };
  const userJson = JSON.stringify(capped);
  const prompt = `${BATCH_SYSTEM_PROMPT}\n\nINPUT_JSON:\n${userJson}`;

  const run = async () => {
    const res = await model.generateContent(prompt);
    return stripJsonFence(res.response.text());
  };

  const timeoutMs = env.NPAT_EVAL_TIMEOUT_MS;
  return await Promise.race([
    run(),
    new Promise((_, rej) => {
      setTimeout(() => rej(new Error('Gemini request timeout')), timeoutMs);
    }),
  ]);
}

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
 * @returns {Promise<{ source: 'gemini' | 'fallback', payload: { rounds: Array<{ roundIndex: number, round: string, results: unknown[] }> } }>}
 */
export async function evaluateNpatFullGame(env, engine, logger) {
  const input = buildNpatFullGameEvaluationInput(engine);
  if (input.rounds.length === 0) {
    return { source: 'fallback', payload: { rounds: [] } };
  }

  const fallback = () => ({
    source: /** @type {const} */ ('fallback'),
    payload: evaluateNpatFullGameFallback(engine),
  });

  if (!env.GEMINI_API_KEY?.trim()) {
    logger.info({ event: 'npat_full_eval_no_api_key' }, 'npat_eval');
    return fallback();
  }

  const expectedRoundIndices = new Set(engine.results.rounds.map((r) => r.roundIndex));

  let lastErr = /** @type {Error | null} */ (null);
  const attempts = env.NPAT_EVAL_MAX_RETRIES + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const rawText = await callGeminiFullGame(env, input, logger);
      const json = JSON.parse(rawText);
      const parsed = safeParseFullGamePayload(json);
      if (!parsed.ok) {
        lastErr = parsed.error;
        logger.warn({ err: parsed.error, attempt }, 'npat_full_eval_parse');
      } else {
        const gotIdx = new Set(parsed.data.rounds.map((r) => r.roundIndex));
        if (gotIdx.size !== expectedRoundIndices.size) {
          lastErr = new Error('Gemini batch missing rounds');
          logger.warn({ attempt }, 'npat_full_eval_incomplete_rounds');
        } else {
          let ok = true;
          for (const idx of expectedRoundIndices) {
            if (!gotIdx.has(idx)) ok = false;
          }
          if (ok) {
            return { source: 'gemini', payload: parsed.data };
          }
        }
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      logger.warn({ err: lastErr, attempt }, 'npat_full_eval_gemini');
    }
    if (attempt < attempts - 1) {
      await sleep(300 * (attempt + 1));
    }
  }

  if (lastErr) {
    logger.warn({ err: lastErr }, 'npat_full_eval_using_fallback');
  }
  return fallback();
}
