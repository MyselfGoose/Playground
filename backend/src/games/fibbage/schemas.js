import { z } from 'zod';
import {
  FIBBAGE_MIN_ROUND_COUNT,
  FIBBAGE_MAX_ROUND_COUNT,
  FIBBAGE_MIN_WRITING_SECONDS,
  FIBBAGE_MAX_WRITING_SECONDS,
  FIBBAGE_MIN_VOTING_SECONDS,
  FIBBAGE_MAX_VOTING_SECONDS,
  FIBBAGE_LIE_MIN_LENGTH,
  FIBBAGE_LIE_MAX_LENGTH,
} from './constants.js';

export const fibbageCreateRoomSchema = z
  .object({
    settings: z
      .object({
        presetId: z.enum(['classic', 'blitz', 'marathon', 'custom']).optional(),
        roundCount: z.number().int().min(FIBBAGE_MIN_ROUND_COUNT).max(FIBBAGE_MAX_ROUND_COUNT).optional(),
        writingSeconds: z.number().int().min(FIBBAGE_MIN_WRITING_SECONDS).max(FIBBAGE_MAX_WRITING_SECONDS).optional(),
        votingSeconds: z.number().int().min(FIBBAGE_MIN_VOTING_SECONDS).max(FIBBAGE_MAX_VOTING_SECONDS).optional(),
        categoryMode: z.enum(['all', 'single']).optional(),
        categoryIds: z.array(z.string().trim().min(1)).max(20).optional(),
      })
      .optional(),
  })
  .optional()
  .default({});

export const fibbageJoinRoomSchema = z.object({
  code: z.string().trim().min(1).max(10),
});

export const fibbageSetReadySchema = z.object({
  ready: z.boolean(),
});

export const fibbageUpdateSettingsSchema = z.object({
  presetId: z.enum(['classic', 'blitz', 'marathon', 'custom']).optional(),
  roundCount: z.number().int().min(FIBBAGE_MIN_ROUND_COUNT).max(FIBBAGE_MAX_ROUND_COUNT).optional(),
  writingSeconds: z.number().int().min(FIBBAGE_MIN_WRITING_SECONDS).max(FIBBAGE_MAX_WRITING_SECONDS).optional(),
  votingSeconds: z.number().int().min(FIBBAGE_MIN_VOTING_SECONDS).max(FIBBAGE_MAX_VOTING_SECONDS).optional(),
  categoryMode: z.enum(['all', 'single']).optional(),
  categoryIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export const fibbageSubmitLieSchema = z.object({
  text: z.string().trim().min(FIBBAGE_LIE_MIN_LENGTH).max(FIBBAGE_LIE_MAX_LENGTH),
});

export const fibbageCastVoteSchema = z.object({
  answerId: z.string().trim().min(1),
});
