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

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Number of trusted reverse proxies (0 = do not trust `X-Forwarded-*`). */
    TRUST_PROXY: z.coerce.number().int().min(0).max(32).default(0),
    /** Comma-separated allowed browser origins (required in production). */
    CORS_ORIGIN: z.preprocess((v) => {
      const raw = nonemptyOrUndefined(v);
      if (isProductionEnv()) {
        return raw ?? '';
      }
      if (!raw || raw === '*') {
        return DEFAULT_CORS_ORIGIN;
      }
      return raw;
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
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
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
 * Parsed, validated environment. Call once during boot; throws via process.exit on failure.
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
    console.error('Invalid environment configuration:', detail.fieldErrors, detail.formErrors);
    process.exit(1);
  }

  cached = parsed.data;

  if (usedDevDefaults && cached.NODE_ENV !== 'production') {
    console.warn(
      '[config] Missing MONGO_URI and/or JWT secrets — using local development defaults (see src/config/devDefaults.js). Copy .env.example to .env and set real values before deploying or sharing a network.',
    );
  }

  return cached;
}
