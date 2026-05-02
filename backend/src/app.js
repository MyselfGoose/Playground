import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { requestContext } from './middleware/requestContext.js';
import { notFound } from './middleware/notFound.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/health.js';
import { apiRouter } from './routes/api.js';
import { createAuthRouter } from './routes/auth.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { createLeaderboardRouter } from './routes/leaderboard.js';
import { createUsersRouter } from './routes/users.js';
import { createHangmanRouter } from './routes/hangman.js';

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

  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (env.NODE_ENV === 'production' && corsOrigins.some((o) => o === '*')) {
    logger.error(
      { CORS_ORIGIN: env.CORS_ORIGIN },
      'cors_rejected_wildcard_in_production_set_explicit_origins_only',
    );
  }

  /** @type {import('cors').CorsOptions} */
  const corsOptions = {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
    preflightContinue: false,
  };

  const corsMiddleware = cors(corsOptions);

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path, origin: req.get('origin') }, 'request_hit');
    next();
  });

  app.use(corsMiddleware);
  app.options('*', corsMiddleware);

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

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  });
  app.use(limiter);

  app.use(cookieParser());
  app.use((req, res, next) => {
    const limit =
      req.method === 'POST' && req.path === '/api/v1/feedback' ? env.FEEDBACK_BODY_LIMIT : env.REQUEST_BODY_LIMIT;
    express.json({ limit })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  // Routes mount only after CORS + parsers.
  app.use(apiRouter);
  app.use('/api/v1/auth', createAuthRouter({ env }));
  app.use('/api/v1/feedback', createFeedbackRouter({ env }));
  app.use('/api/v1/leaderboard', createLeaderboardRouter({ env }));
  app.use('/api/v1/users', createUsersRouter());
  app.use('/api/v1/hangman', createHangmanRouter({ env }));
  app.use(createHealthRouter({ env }));

  app.use(notFound);
  app.use(createErrorHandler(env));

  return app;
}
