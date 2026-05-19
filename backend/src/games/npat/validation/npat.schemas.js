import { z } from 'zod';
import { NPAT_FIELDS, NPAT_MAX_ROUNDS_LIMIT } from '../constants.js';
import { normalizeNpatMode } from '../npatModeUtils.js';

const npatModeInput = z.enum(['solo', 'free-for-all', 'team']);

export const npatModeSchema = npatModeInput.transform((m) => normalizeNpatMode(m));

export const createRoomSchema = z.object({
  mode: npatModeSchema,
  maxRounds: z.number().int().min(1).max(NPAT_MAX_ROUNDS_LIMIT).optional(),
});

/**
 * @param {number} codeLength
 */
export function createJoinRoomBodySchema(codeLength) {
  return z.object({
    code: z
      .string()
      .trim()
      .regex(new RegExp(`^\\d{${codeLength}}$`), `Room code must be exactly ${codeLength} digits`),
  });
}

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

export const proposeEarlyFinishSchema = z.object({});

export const voteEarlyFinishSchema = z.object({
  accept: z.boolean(),
});
