import { createNpatGenerativeModel } from '../npat/npatGeminiModel.js';
import { buildNpatCanonicalPrompt } from './npatPromptBuilder.js';
import { buildNpatEvaluationInput, buildNpatFullGameEvaluationInput } from '../npat/npatEvaluationInput.js';
import { safeParseFullGamePayload } from '../npat/npatGameEvaluationSchema.js';
import { evaluateNpatRoundFallback } from '../npat/npatEvaluationFallback.js';
import { recordNpatEvaluationEvent } from '../../observability/serviceHealth.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripJsonFence(text) {
  let trimmed = String(text ?? '').trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return trimmed.trim();
}

export function classifyFailure(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('rate')) return 'rate_limit';
  if (message.includes('quota')) return 'quota';
  if (message.includes('api key') || message.includes('auth') || message.includes('permission')) {
    return 'auth';
  }
  if (message.includes('json')) return 'parse_error';
  if (message.includes('schema') || message.includes('zod')) return 'schema_error';
  if (message.includes('integrity') || message.includes('missing')) return 'integrity_error';
  return 'provider_error';
}

/**
 * @param {{ rounds: Array<{ roundIndex: number, players: Array<{ playerId: string }> }> }} input
 * @param {{ rounds: Array<{ roundIndex: number, results: Array<{ playerId: string }> }> }} payload
 */
function verifyIntegrity(input, payload) {
  if (payload.rounds.length !== input.rounds.length) {
    throw new Error('integrity_error: round_count_mismatch');
  }
  const expectedRoundIds = new Set(input.rounds.map((r) => r.roundIndex));
  for (const round of payload.rounds) {
    if (!expectedRoundIds.has(round.roundIndex)) {
      throw new Error('integrity_error: unexpected_round');
    }
    const inputRound = input.rounds.find((r) => r.roundIndex === round.roundIndex);
    const expectedPlayerIds = new Set((inputRound?.players ?? []).map((p) => p.playerId));
    const actualPlayerIds = new Set(round.results.map((p) => p.playerId));
    if (expectedPlayerIds.size !== actualPlayerIds.size) {
      throw new Error('integrity_error: player_count_mismatch');
    }
    for (const playerId of expectedPlayerIds) {
      if (!actualPlayerIds.has(playerId)) {
        throw new Error('integrity_error: missing_player');
      }
    }
  }
}

function evaluateNpatFullGameFallback(engine) {
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
 * @param {ReturnType<typeof buildNpatFullGameEvaluationInput>} input
 * @param {import('pino').Logger} logger
 * @param {{ roomCode?: string, mode?: 'interactive'|'background' }} context
 */
export async function runNpatEvaluation(env, input, logger, context = {}) {
  const policy =
    context.mode === 'interactive'
      ? {
          timeoutMs: env.NPAT_EVAL_INTERACTIVE_TIMEOUT_MS,
          retries: env.NPAT_EVAL_INTERACTIVE_MAX_RETRIES,
          maxOutputTokens: env.NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS,
        }
      : {
          timeoutMs: env.NPAT_EVAL_TIMEOUT_MS,
          retries: env.NPAT_EVAL_MAX_RETRIES,
          maxOutputTokens: env.NPAT_EVAL_MAX_OUTPUT_TOKENS,
        };
  const attempts = policy.retries + 1;
  const prompt = buildNpatCanonicalPrompt(env, input);
  const model = createNpatGenerativeModel({
    ...env,
    NPAT_EVAL_MAX_OUTPUT_TOKENS: policy.maxOutputTokens,
  });

  logger.info(
    { event: 'npat_eval_prompt_built', roomCode: context.roomCode, mode: context.mode, rounds: input.rounds.length },
    'npat_eval',
  );

  let lastError = null;
  let lastFailureClass = 'provider_error';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const raw = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), policy.timeoutMs);
        }),
      ]);
      const text = stripJsonFence(raw?.response?.text?.());
      const json = JSON.parse(text);
      const parsed = safeParseFullGamePayload(json);
      if (!parsed.ok) {
        throw new Error(`schema_error: ${parsed.error.message}`);
      }
      verifyIntegrity(input, parsed.data);
      logger.info(
        {
          event: 'npat_eval_attempt_success',
          roomCode: context.roomCode,
          mode: context.mode,
          attempt,
          latencyMs: Date.now() - startedAt,
        },
        'npat_eval',
      );
      return {
        source: /** @type {const} */ ('gemini'),
        payload: parsed.data,
        attemptsUsed: attempt,
        failureClass: null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      lastFailureClass = classifyFailure(error);
      logger.warn(
        {
          event: 'npat_eval_attempt_failed',
          roomCode: context.roomCode,
          mode: context.mode,
          attempt,
          latencyMs: Date.now() - startedAt,
          failureClass: lastFailureClass,
          err: error,
        },
        'npat_eval',
      );
      if (attempt < attempts) {
        const delayMs = 250 * 2 ** (attempt - 1);
        logger.info({ event: 'npat_eval_retry_backoff', attempt, delayMs }, 'npat_eval');
        await sleep(delayMs);
      }
    }
  }

  logger.warn(
    {
      event: 'npat_eval_fallback_triggered',
      roomCode: context.roomCode,
      mode: context.mode,
      attemptsUsed: attempts,
      failureClass: lastFailureClass,
      err: lastError,
    },
    'npat_eval',
  );
  return {
    source: /** @type {const} */ ('offline_fallback'),
    attemptsUsed: attempts,
    failureClass: lastFailureClass,
    latencyMs: null,
  };
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ results: { rounds: Array<{ roundIndex: number }> }, players: Map<string, unknown>, code?: string }} engine
 * @param {import('pino').Logger} logger
 * @param {{ mode?: 'interactive'|'background' }} [options]
 */
export async function evaluateNpatFullGameWithStrictService(env, engine, logger, options = {}) {
  const input = buildNpatFullGameEvaluationInput(engine);
  if (input.rounds.length === 0) {
    return { source: 'offline_fallback', payload: { rounds: [] }, attemptsUsed: 0, failureClass: null };
  }
  if (!env.GEMINI_API_KEY?.trim()) {
    return {
      source: 'offline_fallback',
      payload: evaluateNpatFullGameFallback(engine),
      attemptsUsed: 0,
      failureClass: 'auth',
    };
  }
  const evaluated = await runNpatEvaluation(env, input, logger, {
    roomCode: engine.code,
    mode: options.mode ?? 'interactive',
  });
  if (evaluated.source === 'gemini') {
    recordNpatEvaluationEvent({
      source: evaluated.source,
      failureClass: evaluated.failureClass,
      attemptsUsed: evaluated.attemptsUsed,
      latencyMs: evaluated.latencyMs,
    });
    return evaluated;
  }
  recordNpatEvaluationEvent({
    source: evaluated.source,
    failureClass: evaluated.failureClass,
    attemptsUsed: evaluated.attemptsUsed,
    latencyMs: evaluated.latencyMs,
  });
  return {
    ...evaluated,
    payload: evaluateNpatFullGameFallback(engine),
  };
}
