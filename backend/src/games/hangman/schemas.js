import { z } from 'zod';
import { DEFAULT_HANGMAN_DATASET_VERSION } from '../../config/hangmanDefaults.js';
import { HANGMAN_WORD_MAX, HANGMAN_WORD_MIN } from './constants.js';

export const hangmanCreateRoomSchema = z.object({
  maxWrongGuesses: z.number().int().min(4).max(12).optional(),
  minWordLength: z.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  maxWordLength: z.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  datasetVersion: z.string().trim().min(1).max(64).optional(),
});

export const hangmanJoinRoomSchema = z.object({
  code: z.string().min(1).max(8),
});

export const hangmanSetReadySchema = z.object({
  ready: z.boolean(),
});

export const hangmanUpdateSettingsSchema = z.object({
  maxWrongGuesses: z.number().int().min(4).max(12).optional(),
  minWordLength: z.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  maxWordLength: z.number().int().min(HANGMAN_WORD_MIN).max(HANGMAN_WORD_MAX).optional(),
  datasetVersion: z.string().trim().min(1).max(64).optional(),
});

export const hangmanSetterWordSchema = z.object({
  word: z.string().min(1).max(64),
});

export const hangmanRandomWordSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional(),
});

export const hangmanGuessLetterSchema = z.object({
  letter: z.string().min(1).max(4),
});
