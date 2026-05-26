# NPAT AI Production Runbook

## Overview
NPAT evaluation uses Gemini with strict JSON schema enforcement, model/key failover chains, and controlled offline fallback.
Game flow must continue even when Gemini is degraded.

## Required Railway Environment
- `GEMINI_API_KEY` (server-side secret only)
- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_MODEL_FALLBACKS` (recommended: `gemini-2.5-flash-lite`)
- `GEMINI_API_KEY_FALLBACKS` (optional standby keys)
- `NPAT_EVAL_INTERACTIVE_TIMEOUT_MS`
- `NPAT_EVAL_INTERACTIVE_MAX_RETRIES`
- `NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS`
- `NPAT_EVAL_TIMEOUT_MS`
- `NPAT_EVAL_MAX_RETRIES`
- `NPAT_EVAL_MAX_OUTPUT_TOKENS`
- `NPAT_EVAL_MAX_ANSWER_CHARS`

See [npat-ai-setup-guide.md](./npat-ai-setup-guide.md) for how to obtain keys and model names.

## Health and Reliability Signals
- `GET /health` includes:
  - `ai.state`, `ai.reason`, `ai.activeModel`, `ai.modelChain`, `ai.keyCount`
  - `ai.lastFailureClass`, `ai.lastProbeModel`
  - `npatEvaluation.fallbackRate`
  - `npatEvaluation.alerts.fallbackRateHigh`
  - `npatEvaluation.alerts.repeatedAuthOrQuotaFailures`
- Structured logs include:
  - `npat_eval_attempt_failed`
  - `npat_eval_retry_backoff`
  - `npat_eval_fallback_triggered`
  - `failureClass`, `modelId`, `modelIndex`, `keyIndex`, `attemptsUsed`, `roomCode`, `mode`

## Alert Thresholds
- Fallback rate high: `fallbackRate >= 0.20` over 10-minute window with at least 10 evaluations.
- Critical auth/quota condition: at least 3 auth or quota failures within the 10-minute window.

## Incident Response
### Rate limit spike
1. Confirm `failureClass=rate_limit` in logs.
2. Check current fallback rate from `/health`.
3. Add `GEMINI_MODEL_FALLBACKS` or `GEMINI_API_KEY_FALLBACKS` if not configured.
4. Increase provider quota/tier or reduce evaluation concurrency.

### Model not found / deprecated model
1. Confirm `failureClass=model_not_found` in logs.
2. Update `GEMINI_MODEL` to a supported ID (see setup guide `curl` list).
3. Add retired models to `GEMINI_MODEL_BLOCKLIST` and set fallbacks.
4. Redeploy and verify `ai.activeModel` on `/health`.

### Quota exhausted
1. Confirm `failureClass=quota`.
2. Rotate to backup key (`GEMINI_API_KEY_FALLBACKS`) or restore quota.
3. Keep monitoring fallback rate until Gemini success recovers.

### Auth failure
1. Confirm `failureClass=auth`.
2. Verify `GEMINI_API_KEY` value in Railway and redeploy.
3. Re-run health probe and check `ai.state` returns `healthy`.

## Key Rotation Guidance
- Maintain at least one standby key in `GEMINI_API_KEY_FALLBACKS`.
- Rotate keys during low traffic windows.
- Validate `/health` and one NPAT evaluation after rotation.

## Pre-push Production Checklist
- NPAT integration tests pass.
- New unit tests for router, prompt builder, and evaluation service pass.
- `/health` exposes AI state and NPAT fallback stats.
- `node scripts/startup-pipeline.mjs --probe-gemini` succeeds (or documents known rate-limit deferral).
