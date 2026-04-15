import { createRequire } from 'node:module';
import { Router } from 'express';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    version,
  });
});
