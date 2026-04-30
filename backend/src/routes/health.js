import { createRequire } from 'node:module';
import { Router } from 'express';
import { getAggregatedHealth, getAiHealth, getNpatEvaluationStats } from '../observability/serviceHealth.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');
/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createHealthRouter({ env }) {
  const healthRouter = Router();
  healthRouter.get('/health', (_req, res) => {
    const aggregated = getAggregatedHealth(env);
    const code = aggregated.status === 'fail' ? 503 : 200;
    res.status(code).json({
      ok: aggregated.status !== 'fail',
      status: aggregated.status,
      services: aggregated.services,
      ai: getAiHealth(),
      npatEvaluation: getNpatEvaluationStats(),
      uptime: process.uptime(),
      version,
    });
  });
  return healthRouter;
}
