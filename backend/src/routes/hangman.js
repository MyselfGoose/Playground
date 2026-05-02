import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { DEFAULT_HANGMAN_DATASET_VERSION } from '../config/hangmanDefaults.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hangmanWordRepository } from '../repositories/hangmanWordRepository.js';
import { HANGMAN_WORD_MAX, HANGMAN_WORD_MIN } from '../games/hangman/constants.js';

const randomWordQuerySchema = z.object({
  datasetVersion: z.string().trim().min(1).max(64).optional(),
  minLength: z.coerce.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  maxLength: z.coerce.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
});

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createHangmanRouter({ env }) {
  const router = Router();

  const randomLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: Math.min(120, env.RATE_LIMIT_MAX),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  });

  router.get(
    '/word/random',
    randomLimiter,
    asyncHandler(async (req, res) => {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' },
        });
      }
      const q = randomWordQuerySchema.parse(req.query);
      let minLength = q.minLength ?? HANGMAN_WORD_MIN;
      let maxLength = q.maxLength ?? HANGMAN_WORD_MAX;
      if (minLength > maxLength) [minLength, maxLength] = [maxLength, minLength];

      const picked = await hangmanWordRepository.randomWord({
        datasetVersion: q.datasetVersion ?? DEFAULT_HANGMAN_DATASET_VERSION,
        minLength,
        maxLength,
        difficulty: q.difficulty,
      });

      if (!picked) {
        return res.status(404).json({
          error: {
            message: 'No words found — import dataset with npm run db:import:hangman',
            code: 'WORD_BANK_EMPTY',
          },
        });
      }

      res.json({
        data: {
          length: picked.length,
          word: picked.word,
        },
      });
    }),
  );

  return router;
}
