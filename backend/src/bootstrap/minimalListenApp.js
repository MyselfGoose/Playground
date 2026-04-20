import express from 'express';
import cors from 'cors';

/**
 * Minimal Express app when env validation fails: still binds HTTP so Railway sees a live process.
 * Includes permissive CORS so preflight requests don't 502 at the proxy layer.
 * @param {{ flatten?: Record<string, unknown> }} [params]
 */
export function createMinimalListenApp({ flatten } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({ origin: true, credentials: true }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      degraded: true,
      reason: 'ENV_INVALID',
      detail: flatten ?? null,
    });
  });

  app.use((_req, res) => {
    res.status(503).json({
      error: {
        message:
          'Service unavailable: environment configuration is invalid. Fix variables and redeploy. See /health for details.',
      },
    });
  });

  return app;
}
