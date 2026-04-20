import express from 'express';

/**
 * Minimal Express app when env validation fails: still binds HTTP so Railway sees a live process.
 * @param {{ flatten?: Record<string, unknown> }} [params]
 */
export function createMinimalListenApp({ flatten } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

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
