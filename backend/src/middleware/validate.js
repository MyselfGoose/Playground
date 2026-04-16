import { AppError } from '../errors/AppError.js';

/**
 * @param {import('zod').ZodTypeAny} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn({ issues: parsed.error.flatten(), event: 'validation_failed' }, 'validation_failed');
      const issue = parsed.error.issues[0];
      const detail =
        issue && issue.path.length
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue?.message ?? 'Validation failed';
      return next(new AppError(400, detail, { code: 'VALIDATION_ERROR', expose: true }));
    }
    req.body = parsed.data;
    next();
  };
}
