import { z } from 'zod';
import { NPAT_FIELDS } from '../constants.js';

export const npatModeSchema = z.enum(['solo', 'team']);

export const createRoomSchema = z.object({
  mode: npatModeSchema,
});

export const joinRoomSchema = z.object({
  code: z.string().trim().regex(/^\d+$/).min(1).max(16),
});

export const switchTeamSchema = z.object({
  teamId: z.string().trim().min(1).max(8),
});

export const setReadySchema = z.object({
  ready: z.boolean(),
});

export const startGameSchema = z.object({});

const fieldSchema = z.enum(NPAT_FIELDS);

export const submitFieldSchema = z.object({
  field: fieldSchema,
  value: z
    .string()
    .trim()
    .min(1, 'Answer cannot be empty')
    .max(120, 'Answer is too long'),
});
