import { z } from 'zod';

function stripUnsafe(s) {
  return String(s ?? '')
    .replace(/\0/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n');
}

const clientSchema = z
  .object({
    path: z.string().max(2000).optional(),
    url: z.string().max(4000).optional(),
    userAgent: z.string().max(2000).optional(),
    submittedAt: z.string().max(64).optional(),
    platform: z.string().max(200).optional(),
    referrer: z.string().max(4000).optional(),
  })
  .optional()
  .default({});

const screenshotSchema = z.object({
  name: z.string().max(200).optional(),
  /** Declared MIME (optional); server trusts magic bytes on decode. */
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional(),
  /** Base64 (optionally with data URL prefix); validated again server-side by magic bytes. */
  data: z.string().max(8_000_000),
});

export const feedbackBodySchema = z
  .object({
    type: z.enum(['bug', 'feature', 'ui', 'general']),
    title: z
      .string()
      .max(500)
      .transform((s) => stripUnsafe(s).trim())
      .pipe(z.string().min(1, 'title required').max(120)),
    description: z
      .string()
      .max(12_000)
      .transform((s) => stripUnsafe(s).trim())
      .pipe(z.string().min(1, 'description required').max(8000)),
    contactEmail: z
      .union([z.string().max(320), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === null) return null;
        const t = stripUnsafe(v).trim();
        return t.length === 0 ? null : t;
      }),
    /** Honeypot — must be empty */
    website: z.string().max(200).optional(),
    /** Optional screenshot (PNG / JPEG / WebP). Stored via GitHub Contents API, then linked in the issue. */
    screenshot: z.union([screenshotSchema, z.null(), z.undefined()]).optional(),
    client: clientSchema,
  })
  .superRefine((data, ctx) => {
    if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid email',
        path: ['contactEmail'],
      });
    }
    if (data.website && data.website.trim().length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid submission',
        path: ['website'],
      });
    }
    const combined = data.title.length + data.description.length;
    if (combined < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please add more detail (title + description at least 20 characters)',
        path: ['description'],
      });
    }
  });
