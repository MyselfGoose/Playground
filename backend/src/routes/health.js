import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { Router } from 'express';
import { getAggregatedHealth, getAiHealth, getNpatEvaluationStats } from '../observability/serviceHealth.js';
import { getPlatformMetrics } from '../observability/platformMetrics.js';

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

  /** Process is up (for orchestrator probes). */
  healthRouter.get('/health/live', (_req, res) => {
    res.status(200).json({ ok: true, uptime: process.uptime(), version });
  });

  /** Ready to serve DB-backed traffic (Mongo connected). */
  healthRouter.get('/health/ready', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    if (!db) {
      return res.status(503).json({
        ok: false,
        reason: 'mongodb_not_connected',
        mongoReadyState: mongoose.connection.readyState,
      });
    }
    res.status(200).json({ ok: true, mongoReadyState: mongoose.connection.readyState });
  });

  /** In-process counters for lightweight observability (plan: replace with Prometheus). */
  healthRouter.get('/health/metrics', (_req, res) => {
    res.status(200).json(getPlatformMetrics());
  });

  return healthRouter;
}
