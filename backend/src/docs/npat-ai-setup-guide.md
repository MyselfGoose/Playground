# NPAT AI scoring — setup and configuration guide

This guide explains how to enable Google Gemini scoring for **Name, Place, Animal, Thing (NPAT)** so finished games show **AI scored** results with per-answer notes. For production incidents, see [npat-ai-runbook.md](./npat-ai-runbook.md).

## How scoring works

1. When a game ends, the backend enters `EVALUATING` and calls Gemini with all rounds in one JSON batch.
2. On success, clients receive `evaluationSource: "gemini"` and rich `comment` fields per answer.
3. On failure (missing key, bad model, timeout, etc.), the server uses **rules-based fallback** (`evaluationSource: "fallback"`) so the game still finishes. A background job may retry with longer timeouts and upgrade results to AI later.

The frontend never calls Gemini directly. Keys live only on the backend (Railway / local `backend/.env`).

---

## Step 1 — Obtain a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/apikey).
2. Create an API key for your Google Cloud / AI Studio project.
3. (Recommended) Restrict the key to the **Generative Language API** and your deployment IPs if your org supports that.
4. Copy the key once — you will not see it again.

**Never** put `GEMINI_API_KEY` in the frontend, Vercel env, or git. Backend only.

---

## Step 2 — Discover valid model names

Google retires model IDs on a schedule. Always confirm names before production.

### List models (authoritative)

```bash
export GEMINI_API_KEY="your-key-here"
curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}" \
  | jq -r '.models[] | select(.supportedGenerationMethods[]? == "generateContent") | .name'
```

The API returns names like `models/gemini-2.5-flash`. In `.env`, use **only the suffix**:

```bash
GEMINI_MODEL=gemini-2.5-flash
```

### Official references

- [Gemini models](https://ai.google.dev/gemini-api/docs/models) — capabilities and IDs
- [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog) — deprecation and shutdown dates

### Smoke-test one model

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Reply with JSON only: {\"ok\":true}"}]}],"generationConfig":{"responseMimeType":"application/json"}}'
```

A `404` or “model not found” means that ID is wrong or retired for your project — pick another from the list above.

---

## Step 3 — Configure `backend/.env` (local)

Copy the template if needed:

```bash
cp backend/.env.example backend/.env
```

### Minimum (local dev with real AI)

```bash
GEMINI_API_KEY=your-primary-key
GEMINI_MODEL=gemini-2.5-flash
```

### Recommended production-style block

```bash
GEMINI_API_KEY=your-primary-key
GEMINI_API_KEY_FALLBACKS=your-standby-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite
NPAT_EVAL_INTERACTIVE_MAX_RETRIES=1
NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS=6144
NPAT_EVAL_MAX_OUTPUT_TOKENS=8192
```

### Local dev without billing (mock)

```bash
GEMINI_MOCK_MODE=true
```

Deterministic JSON is returned; UI shows **AI scored** without calling Google.

---

## Environment variable reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | For real AI | — | Primary Google AI API key |
| `GEMINI_API_KEY_FALLBACKS` | No | — | Comma-separated backup keys (tried after primary key exhausts all models) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Primary model ID |
| `GEMINI_MODEL_FALLBACKS` | No | — | Comma-separated model IDs tried after primary fails per key |
| `GEMINI_MODEL_BLOCKLIST` | No | — | Comma-separated model IDs to skip (emergency disable) |
| `GEMINI_MOCK_MODE` | No | `false` | `true` / `1` = in-process mock (CI, offline UI) |
| `NPAT_EVAL_INTERACTIVE_TIMEOUT_MS` | No | `15000` | Timeout for in-room evaluation |
| `NPAT_EVAL_INTERACTIVE_MAX_RETRIES` | No | `1` | Retries per model/key combo (interactive) |
| `NPAT_EVAL_INTERACTIVE_MAX_OUTPUT_TOKENS` | No | `6144` | Max output tokens cap (interactive); dynamic estimate may go lower |
| `NPAT_EVAL_TIMEOUT_MS` | No | `25000` | Timeout for health probe / background upgrade |
| `NPAT_EVAL_MAX_RETRIES` | No | `2` | Retries per model/key combo (background) |
| `NPAT_EVAL_MAX_OUTPUT_TOKENS` | No | `8192` | Max output tokens cap (background) |
| `NPAT_EVAL_MAX_ANSWER_CHARS` | No | `120` | Truncate long answers in the prompt |

### Failover behavior (summary)

For each API key (primary, then fallbacks):

1. Try `GEMINI_MODEL`, then each entry in `GEMINI_MODEL_FALLBACKS` (minus `GEMINI_MODEL_BLOCKLIST`).
2. For each model, retry transient errors (`timeout`, `rate_limit`, parse errors, etc.) up to the configured retry count.
3. On `auth` or `model_not_found`, skip to the next model or key immediately.
4. If everything fails, return rules-based scores and set `evaluationFailureClass` for logs/UI.

---

## Step 4 — Verify locally

### Health probe (full NPAT pipeline)

```bash
cd backend
node -e "import('./src/services/npat/npatGeminiHealth.js').then(m=>m.runGeminiHealthCheck().then(r=>{console.log(JSON.stringify(r,null,2));process.exit(r.ok?0:1)}))"
```

Expect `{ "ok": true, "modelUsed": "gemini-2.5-flash" }` (or your primary model).

### HTTP health (with server running)

```bash
curl -sS http://localhost:4000/health | jq '{status, services, ai, npatEvaluation}'
```

When a key is configured and AI works:

- `services.ai` should be `true`
- `ai.state` should be `healthy`
- `ai.activeModel` should show the model that succeeded on the last probe

### Play one NPAT game

Finish a game with at least one round. Results should show **Overall: AI scored** and notes that are not only generic offline copy (“Passes letter and non-empty checks…”).

---

## Step 5 — Railway (remote) deployment

1. Open your **backend** service on Railway (not the Vercel frontend).
2. Variables → add/update:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite` (recommended)
   - Optional: `GEMINI_API_KEY_FALLBACKS`
3. Ensure `GEMINI_MOCK_MODE` is **unset** or `false`.
4. Redeploy the backend.
5. Hit production `GET /health` and confirm `ai.state`.
6. Run one NPAT game on production and confirm **AI scored**.

### Pre-deploy script (optional)

From repo root:

```bash
node scripts/startup-pipeline.mjs --probe-gemini
```

Format-only check (no live API call) runs by default in the `gemini-key-check` stage.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| **Rules scored** everywhere | Missing/invalid key, bad model, quota | Check `evaluationFailureClass` in logs; verify env on Railway |
| `failureClass: auth` | No key or revoked key | Set `GEMINI_API_KEY`; redeploy |
| `failureClass: model_not_found` | Retired model ID | Update `GEMINI_MODEL`; add `GEMINI_MODEL_FALLBACKS` |
| `failureClass: rate_limit` / `quota` | Provider limits | Add backup key/model; wait; upgrade quota |
| `failureClass: parse_error` / `schema_error` | Truncated JSON (large games) | Raise `NPAT_EVAL_*_MAX_OUTPUT_TOKENS`; reduce players/rounds |
| `/health` `services.ai: false` but key is set | Boot probe failed | Run local health probe; read `ai.reason` |
| UI says AI but notes look generic | Background upgrade not arrived yet | Wait or refresh; check logs for `npat_background_upgrade_applied` |

### Log events to search

- `npat_eval_attempt_failed` — includes `failureClass`, `modelId`, `keyIndex`
- `npat_eval_fallback_triggered`
- `gemini_health_check_failed_boot_continues`

---

## Model migration note (2026)

`gemini-2.0-flash` is scheduled for shutdown **June 1, 2026**. Migrate to `gemini-2.5-flash` (or newer supported IDs from the list API) before that date. Keep at least one entry in `GEMINI_MODEL_FALLBACKS` so the next retirement does not require an emergency deploy.

---

## Related files

- Evaluation service: `backend/src/services/ai/npatEvaluationService.js`
- Model router: `backend/src/services/npat/npatGeminiRouter.js`
- Incident runbook: `backend/src/docs/npat-ai-runbook.md`
