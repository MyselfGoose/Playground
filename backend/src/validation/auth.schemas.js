import { z } from 'zod';

/**
 * Strong password rules for registration only. Logging in with an old password that
 * no longer meets today's complexity rules must still work, so login uses a lighter schema.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

/** Lenient password schema for login — only presence and a sane upper bound. */
export const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(128, 'Password is too long');

export const registerBodySchema = z.object({
  username: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscore, hyphen'),
  ),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().email().max(254),
  ),
  password: passwordSchema,
});

export const loginBodySchema = z
  .object({
    email: z.preprocess(
      (v) => (v === undefined || v === '' ? undefined : String(v).trim().toLowerCase()),
      z.string().email().max(254).optional(),
    ),
    username: z.preprocess(
      (v) => (v === undefined || v === '' ? undefined : String(v).trim()),
      z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    ),
    password: loginPasswordSchema,
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email);
    const hasUsername = Boolean(data.username);
    if (!hasEmail && !hasUsername) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email or username',
        path: ['email'],
      });
    }
    if (hasEmail && hasUsername) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide only one of email or username',
        path: ['username'],
      });
    }
  });
