import { z } from 'zod';

export const adminUserSearchQuerySchema = z.object({
  q: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adminUserPatchBodySchema = z.object({
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(['user', 'admin', 'moderator'])).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  reason: z.string().max(2000).optional(),
  moderation: z
    .object({
      status: z.enum(['none', 'suspended', 'banned']),
      reason: z.string().max(2000).optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      internalNotes: z.string().max(5000).optional(),
    })
    .optional(),
});

export const adminStatsPatchBodySchema = z.object({
  patch: z.record(z.string(), z.number().nonnegative()),
});

export const adminMaintenancePatchBodySchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().max(500).optional(),
});

export const adminMatchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  skip: z.coerce.number().int().min(0).optional().default(0),
  game: z.enum(['all', 'typing-race', 'npat', 'taboo', 'hangman', 'cah']).optional().default('all'),
});

export const adminFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(30),
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
});

export const adminRoomsQuerySchema = z.object({
  game: z.enum(['npat', 'typing-race', 'taboo', 'cah', 'hangman']).optional(),
});

export const adminRoomKickBodySchema = z.object({
  userId: z.string().min(1),
});

export const adminOAuthPatchBodySchema = z.object({
  googleOAuthEnabled: z.boolean(),
});

export const adminGamesPatchBodySchema = z.object({
  disabledGames: z.array(z.enum(['npat', 'typing-race', 'taboo', 'cah', 'hangman'])),
});

export const adminRoomCreationPatchBodySchema = z.object({
  blockNewRooms: z.boolean(),
});

export const adminAbuseQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminNpatListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
