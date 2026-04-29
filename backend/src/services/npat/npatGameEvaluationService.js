import { buildNpatEvaluationInput, buildNpatFullGameEvaluationInput } from './npatEvaluationInput.js';
import { evaluateNpatRoundFallback } from './npatEvaluationFallback.js';
import { createNpatGenerativeModel } from './npatGeminiModel.js';
import { safeParseFullGamePayload } from './npatGameEvaluationSchema.js';
import { evaluateNpatRound } from './npatEvaluationService.js';

const BATCH_SYSTEM_PROMPT = `Judge NPAT rounds. Return JSON only (no markdown/fences).

Rules per round:
- Answers must start with round letter (case-insensitive, trimmed).
- Categories: name/place/animal/thing.
- Empty answers are invalid.
- Duplicate means same normalized text (trim/lower/collapse spaces) in same round+category.
- Flags: unique valid => isValid=true,isDuplicate=false; duplicate valid => isValid=true,isDuplicate=true; invalid => isValid=false.

Output shape:
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

Include all rounds and all players from INPUT_JSON exactly once.
Keep each comment very short (<= 6 words).`;

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
async function callGeminiFullGame(env, input) {
  const key = env.GEMINI_API_KEY;
  if (!key?.trim()) {
    throw new Error('GEMINI_API_KEY missing');
  }
  const model = createNpatGenerativeModel(env);
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
    const raw = stripJsonFence(res.response.text());
    if (!raw || !String(raw).trim()) {
      throw new Error('Gemini returned empty evaluation JSON');
    }
    return raw;
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
 * @param {import('../../config/env.js').Env} env
 * @param {'interactive'|'background'} mode
 */
function evaluationPolicy(env, mode) {
  if (mode === 'interactive') {
    return {
      timeoutMs: env.NPAT_EVAL_INTERACTIVE_TIMEOUT_MS,
      retries: env.NPAT_EVAL_INTERACTIVE_MAX_RETRIES,
      maxOutputTokens: env.NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS,
    };
  }
  return {
    timeoutMs: env.NPAT_EVAL_TIMEOUT_MS,
    retries: env.NPAT_EVAL_MAX_RETRIES,
    maxOutputTokens: env.NPAT_EVAL_MAX_OUTPUT_TOKENS,
  };
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
 * @param {{ mode?: 'interactive'|'background' }} [options]
 * @returns {Promise<{ source: 'gemini' | 'fallback', payload: { rounds: Array<{ roundIndex: number, round: string, results: unknown[] }> } }>}
 */
export async function evaluateNpatFullGame(env, engine, logger, options = {}) {
  const mode = options.mode ?? 'interactive';
  const input = buildNpatFullGameEvaluationInput(engine);
  if (input.rounds.length === 0) {
    return { source: 'fallback', payload: { rounds: [] } };
  }
  const startedAt = Date.now();

  const fallback = () => ({
    source: /** @type {const} */ ('fallback'),
    payload: evaluateNpatFullGameFallback(engine),
  });

  if (!env.GEMINI_API_KEY?.trim()) {
    logger.info({ event: 'npat_full_eval_no_api_key' }, 'npat_eval');
    return fallback();
  }

  const expectedRoundIndices = new Set(engine.results.rounds.map((r) => r.roundIndex));
  const policy = evaluationPolicy(env, mode);

  if (mode === 'interactive' && input.rounds.length > 1) {
    const tunedEnv = {
      ...env,
      NPAT_EVAL_TIMEOUT_MS: policy.timeoutMs,
      NPAT_EVAL_MAX_RETRIES: policy.retries,
      NPAT_EVAL_MAX_OUTPUT_TOKENS: policy.maxOutputTokens,
    };
    const roundResults = await Promise.all(
      input.rounds.map(async (round) => {
        const out = await evaluateNpatRound(
          tunedEnv,
          {
            roundLetter: round.roundLetter,
            language: input.language,
            players: round.players,
          },
          logger,
        );
        return {
          source: out.source,
          payload: { roundIndex: round.roundIndex, ...out.payload },
        };
      }),
    );
    const allGemini = roundResults.every((r) => r.source === 'gemini');
    logger.info(
      {
        event: 'npat_full_eval_metrics',
        mode,
        source: allGemini ? 'gemini' : 'fallback',
        durationMs: Date.now() - startedAt,
        attemptsUsed: 1,
        rounds: input.rounds.length,
        playersPerRound: input.rounds[0]?.players?.length ?? 0,
        timeoutMs: policy.timeoutMs,
        retries: policy.retries,
        maxOutputTokens: policy.maxOutputTokens,
        strategy: 'parallel_per_round',
      },
      'npat_eval',
    );
    return {
      source: allGemini ? 'gemini' : 'fallback',
      payload: {
        rounds: roundResults.map((r) => ({
          roundIndex: r.payload.roundIndex,
          round: r.payload.round,
          results: r.payload.results,
        })),
      },
    };
  }

  let lastErr = /** @type {Error | null} */ (null);
  const attempts = policy.retries + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const rawText = await callGeminiFullGame(
        {
          ...env,
          NPAT_EVAL_TIMEOUT_MS: policy.timeoutMs,
          NPAT_EVAL_MAX_OUTPUT_TOKENS: policy.maxOutputTokens,
        },
        input,
      );
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
            logger.info(
              {
                event: 'npat_full_eval_metrics',
                mode,
                source: 'gemini',
                durationMs: Date.now() - startedAt,
                attemptsUsed: attempt + 1,
                rounds: input.rounds.length,
                playersPerRound: input.rounds[0]?.players?.length ?? 0,
                timeoutMs: policy.timeoutMs,
                retries: policy.retries,
                maxOutputTokens: policy.maxOutputTokens,
              },
              'npat_eval',
            );
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
  logger.warn(
    {
      event: 'npat_full_eval_metrics',
      mode,
      source: 'fallback',
      durationMs: Date.now() - startedAt,
      attemptsUsed: attempts,
      rounds: input.rounds.length,
      playersPerRound: input.rounds[0]?.players?.length ?? 0,
      timeoutMs: policy.timeoutMs,
      retries: policy.retries,
      maxOutputTokens: policy.maxOutputTokens,
      fallbackReason: lastErr?.message ?? 'unknown',
    },
    'npat_eval',
  );
  return fallback();
}
