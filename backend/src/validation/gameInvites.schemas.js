import { z } from 'zod';
import { GAME_INVITE_SLUGS } from '../constants/gameSlugs.js';

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const sendGameInviteBodySchema = z.object({
  recipientId: objectIdSchema,
  gameSlug: z.enum(GAME_INVITE_SLUGS),
  roomCode: z.string().min(1).max(12),
});

export const gameInviteIdParamSchema = z.object({
  inviteId: objectIdSchema,
});

export const markGameInvitesReadBodySchema = z.object({
  inviteIds: z.array(objectIdSchema).optional(),
});
