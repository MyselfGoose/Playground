import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { requestContext } from './middleware/requestContext.js';
import { notFound } from './middleware/notFound.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { apiRouter } from './routes/api.js';

/**
 * Express application factory (no listen). Reusable for tests and future HTTP upgrades.
 * @param {{ env: import('./config/env.js').Env, logger: import('pino').Logger }} params
 */
export function createApp({ env, logger }) {
  const app = express();
  app.disable('x-powered-by');

  if (env.TRUST_PROXY > 0) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  app.use(requestContext());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, _res) => req.id,
      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(helmet());

  const corsOrigin =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      optionsSuccessStatus: 204,
      maxAge: 86_400,
    }),
  );

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  });
  app.use(limiter);

  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  app.use(apiRouter);
  app.use(healthRouter);

  app.use(notFound);
  app.use(createErrorHandler(env));

  return app;
}
