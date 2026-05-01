import { z } from 'zod';

export const cahCreateRoomSchema = z
  .object({
    maxRounds: z.number().int().min(1).max(20).optional(),
    packs: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .strict();

export const cahJoinRoomSchema = z
  .object({
    code: z.string().trim().min(4).max(8),
  })
  .strict();

export const cahSetReadySchema = z
  .object({
    ready: z.boolean(),
  })
  .strict();

export const cahUpdateSettingsSchema = z
  .object({
    maxRounds: z.number().int().min(1).max(20).optional(),
    packs: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .strict();

export const cahSubmitCardsSchema = z
  .object({
    cardIds: z.array(z.number().int().positive()).min(1),
  })
  .strict();

export const cahJudgePickWinnerSchema = z
  .object({
    submissionId: z.string().trim().min(1),
  })
  .strict();
