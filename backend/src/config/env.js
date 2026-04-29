import { z } from 'zod';
import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_JWT_ACCESS_SECRET,
  DEFAULT_JWT_REFRESH_SECRET,
  DEFAULT_MONGO_URI,
} from './devDefaults.js';

function nodeEnvRaw() {
  return process.env.NODE_ENV ?? 'development';
}

function isProductionEnv() {
  return nodeEnvRaw() === 'production';
}

function nonemptyOrUndefined(val) {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Comma-separated origins: trim each, strip trailing slashes (browser `Origin` never includes one).
 */
function normalizeCorsOriginString(v) {
  const raw = nonemptyOrUndefined(v);
  if (!raw) return raw;
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .join(',');
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /**
     * Trusted reverse-proxy hops (Railway, Vercel, etc. need ≥1 for correct `req.ip` and rate-limit).
     * Defaults to 1 in production when unset so express-rate-limit does not reject forwarded clients.
     */
    TRUST_PROXY: z.preprocess((v) => {
      if (v === undefined || v === null || String(v).trim() === '') {
        return isProductionEnv() ? 1 : 0;
      }
      return v;
    }, z.coerce.number().int().min(0).max(32)),
    /** Comma-separated allowed browser origins (required in production). */
    CORS_ORIGIN: z.preprocess((v) => {
      const raw = nonemptyOrUndefined(v);
      if (isProductionEnv()) {
        return normalizeCorsOriginString(raw) ?? '';
      }
      if (!raw || raw === '*') {
        return DEFAULT_CORS_ORIGIN;
      }
      return normalizeCorsOriginString(raw) ?? DEFAULT_CORS_ORIGIN;
    }, z.string().min(1, 'CORS_ORIGIN is required')),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    REQUEST_BODY_LIMIT: z.string().min(1).default('100kb'),

    MONGO_URI: z.preprocess((v) => {
      const s = nonemptyOrUndefined(v);
      if (s) return s;
      if (isProductionEnv()) return '';
      return DEFAULT_MONGO_URI;
    }, z.string().min(1, 'MONGO_URI is required in production — set MONGO_URI in your environment')),
    JWT_ACCESS_SECRET: z.preprocess((v) => {
      const s = nonemptyOrUndefined(v);
      if (s) return s;
      if (isProductionEnv()) return '';
      return DEFAULT_JWT_ACCESS_SECRET;
    }, z.string().min(1, 'JWT_ACCESS_SECRET is required in production')),
    JWT_REFRESH_SECRET: z.preprocess((v) => {
      const s = nonemptyOrUndefined(v);
      if (s) return s;
      if (isProductionEnv()) return '';
      return DEFAULT_JWT_REFRESH_SECRET;
    }, z.string().min(1, 'JWT_REFRESH_SECRET is required in production')),
    JWT_ACCESS_EXPIRY: z.string().min(1).default('15m'),
    JWT_REFRESH_EXPIRY: z.string().min(1).default('7d'),
    BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),

    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

    COOKIE_SECURE: z.preprocess((val) => {
      if (val === undefined || val === '') return undefined;
      const s = String(val).toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
      return val;
    }, z.boolean().optional()),
    COOKIE_SAME_SITE: z.preprocess((v) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim().toLowerCase();
      // Cross-origin deployments (e.g. Vercel frontend → Railway backend) require
      // SameSite=None so the browser actually sends cookies on cross-site requests.
      if (isProductionEnv()) return 'none';
      return 'lax';
    }, z.enum(['strict', 'lax', 'none'])),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),

    NPAT_MAX_PLAYERS: z.coerce.number().int().min(2).max(24).default(8),
    NPAT_ROOM_CODE_LENGTH: z.coerce.number().int().min(4).max(6).default(4),
    NPAT_MIN_PLAYERS_TO_START: z.coerce.number().int().min(2).max(8).default(2),
    NPAT_SUBMIT_RATE_MS: z.coerce.number().int().min(50).max(5000).default(400),
    NPAT_SWITCH_TEAM_RATE_MS: z.coerce.number().int().min(100).max(10_000).default(600),
    NPAT_ROUND_END_COUNTDOWN_MS: z.coerce.number().int().min(1000).max(120_000).default(10_000),
    NPAT_BETWEEN_ROUNDS_MS: z.coerce.number().int().min(1000).max(120_000).default(5000),
    NPAT_STARTING_MS: z.coerce.number().int().min(200).max(10_000).default(1000),
    NPAT_EARLY_FINISH_PROPOSE_RATE_MS: z.coerce.number().int().min(500).max(60_000).default(4000),
    NPAT_EARLY_FINISH_VOTE_RATE_MS: z.coerce.number().int().min(100).max(10_000).default(400),

    /** Google Gemini (server-only). Optional: rounds fall back to heuristic scoring if unset. */
    GEMINI_API_KEY: z.preprocess((v) => nonemptyOrUndefined(v), z.string().optional()),
    GEMINI_MOCK_MODE: z.preprocess((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return false;
      const s = String(v).toLowerCase().trim();
      return s === 'true' || s === '1';
    }, z.boolean().default(false)),
    GEMINI_MODEL: z.string().min(1).default('gemini-2.0-flash'),
    NPAT_EVAL_TIMEOUT_MS: z.coerce.number().int().min(3000).max(120_000).default(25_000),
    NPAT_EVAL_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    NPAT_EVAL_MAX_ANSWER_CHARS: z.coerce.number().int().min(20).max(500).default(120),
    /** Full-game JSON can be large; too low causes truncated JSON → parse failure → offline fallback. */
    NPAT_EVAL_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(2048).max(65_536).default(8192),

    /** GitHub Issues API — optional; feedback POST returns 503 until all three are set (unless FEEDBACK_ENABLED=false). */
    GITHUB_TOKEN: z.preprocess((v) => nonemptyOrUndefined(v), z.string().optional()),
    GITHUB_OWNER: z.preprocess((v) => nonemptyOrUndefined(v), z.string().optional()),
    GITHUB_REPO: z.preprocess((v) => nonemptyOrUndefined(v), z.string().optional()),
    /**
     * When false, POST /api/v1/feedback always responds 503 (kill switch).
     * When true (default), feedback is available only if GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO are all non-empty.
     */
    FEEDBACK_ENABLED: z.preprocess((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return true;
      const s = String(v).toLowerCase().trim();
      if (s === 'false' || s === '0') return false;
      return true;
    }, z.boolean().default(true)),
    FEEDBACK_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    FEEDBACK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    /** JSON body limit for POST /api/v1/feedback only (base64 screenshots). */
    FEEDBACK_BODY_LIMIT: z.string().min(1).default('8mb'),
    /** Decoded image bytes max for optional feedback screenshot. */
    FEEDBACK_SCREENSHOT_MAX_BYTES: z.coerce.number().int().min(50_000).max(5_000_000).default(1_048_576),
    /** Repo path prefix for uploaded screenshots (Contents API). */
    FEEDBACK_SCREENSHOTS_PATH: z.string().min(1).default('.github/feedback-screenshots'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const origins = data.CORS_ORIGIN.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (origins.length === 0 || origins.some((o) => o === '*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'CORS_ORIGIN must be a non-empty comma-separated list of explicit origins in production (never "*")',
          path: ['CORS_ORIGIN'],
        });
      }
    }
    if (data.NODE_ENV === 'production') {
      if (data.JWT_ACCESS_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_ACCESS_SECRET must be at least 32 characters in production',
          path: ['JWT_ACCESS_SECRET'],
        });
      }
      if (data.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_REFRESH_SECRET must be at least 32 characters in production',
          path: ['JWT_REFRESH_SECRET'],
        });
      }
    }
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
        path: ['JWT_REFRESH_SECRET'],
      });
    }
  })
  .transform((data) => ({
    ...data,
    COOKIE_SECURE: data.COOKIE_SECURE ?? data.NODE_ENV === 'production',
  }))
  .superRefine((data, ctx) => {
    // Browsers silently drop SameSite=None cookies that are not also Secure. Fail loud at boot
    // so this misconfiguration doesn't masquerade as an auth bug in production.
    if (data.COOKIE_SAME_SITE === 'none' && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true (HTTPS only)',
        path: ['COOKIE_SAME_SITE'],
      });
    }
  });

/** @typedef {z.infer<typeof envSchema>} Env */

/** @type {Env | undefined} */
let cached;

/**
 * Thrown when `process.env` fails Zod validation. Callers must not use `process.exit` — log and decide.
 */
export class EnvValidationError extends Error {
  /**
   * @param {import('zod').FlattenMaps} flatten
   */
  constructor(flatten) {
    super('Invalid environment configuration');
    this.name = 'EnvValidationError';
    /** @type {import('zod').FlattenMaps} */
    this.flatten = flatten;
  }
}

/**
 * Parsed, validated environment. Call once during boot.
 * @throws {EnvValidationError} when validation fails (never calls `process.exit`)
 * @returns {Env}
 */
export function getEnv() {
  if (cached) {
    return cached;
  }

  const usedDevDefaults =
    nodeEnvRaw() !== 'production' &&
    (!process.env.MONGO_URI?.trim() ||
      !process.env.JWT_ACCESS_SECRET?.trim() ||
      !process.env.JWT_REFRESH_SECRET?.trim());

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.flatten();
    console.error('[config] Invalid environment configuration:', detail.fieldErrors, detail.formErrors);
    throw new EnvValidationError(detail);
  }

  cached = parsed.data;

  if (usedDevDefaults && cached.NODE_ENV !== 'production') {
    console.warn(
      '[config] Missing MONGO_URI and/or JWT secrets — using local development defaults (see src/config/devDefaults.js). Copy .env.example to .env and set real values before deploying or sharing a network.',
    );
  }

  return cached;
}

/**
 * Clear parsed env cache so the next `getEnv()` re-reads `process.env`.
 * Only allowed in test — prevents integration tests from polluting each other.
 */
export function resetEnvCacheForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetEnvCacheForTests is only for NODE_ENV=test');
  }
  cached = undefined;
}
