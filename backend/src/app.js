import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { requestContext } from './middleware/requestContext.js';
import { notFound } from './middleware/notFound.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { apiRouter } from './routes/api.js';
import { createAuthRouter } from './routes/auth.js';

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

  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  /** @type {import('cors').CorsOptions} */
  const corsOptions = {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  };

  // CORS before helmet so preflight gets consistent headers; required for browser credentialed fetches from Vercel.
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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

  app.use(cookieParser());
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  app.use(apiRouter);
  app.use('/api/v1/auth', createAuthRouter({ env }));
  app.use(healthRouter);

  app.use(notFound);
  app.use(createErrorHandler(env));

  return app;
}
