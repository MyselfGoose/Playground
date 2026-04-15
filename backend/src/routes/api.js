import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'games-platform-api',
    message: 'Platform API is running.',
  });
});

apiRouter.get('/api/v1', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'games-platform-api',
    api: 'v1',
    message: 'Multi-game platform API (starter).',
  });
});
