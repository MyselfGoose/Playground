import { AppError } from '../errors/AppError.js';

/**
 * @param {import('zod').ZodTypeAny} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn({ issues: parsed.error.flatten(), event: 'validation_failed' }, 'validation_failed');
      return next(
        new AppError(400, 'Validation failed', { code: 'VALIDATION_ERROR', expose: true }),
      );
    }
    req.body = parsed.data;
    next();
  };
}
