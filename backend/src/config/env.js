import { z } from 'zod';

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

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.flatten();
    console.error('Invalid environment configuration:', detail.fieldErrors, detail.formErrors);
    process.exit(1);
  }

  cached = parsed.data;
  return cached;
}
