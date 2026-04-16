import { z } from 'zod';
import {
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
    /** Comma-separated origins, or `*` in non-production only. */
    CORS_ORIGIN: z.string().min(1).default('*'),
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
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.CORS_ORIGIN.trim() === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'CORS_ORIGIN must be an explicit comma-separated list in production, not "*"',
        path: ['CORS_ORIGIN'],
      });
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
  }));

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
