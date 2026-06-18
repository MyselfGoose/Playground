import { z } from 'zod';
import { usernameFieldSchema } from './auth.schemas.js';

export const updateProfileBodySchema = z.object({
  username: usernameFieldSchema.optional(),
});

const imagePayloadSchema = z.object({
  mime: z.string().max(64).optional(),
  data: z.string().min(1).max(6_000_000),
});

export const avatarUploadBodySchema = z.object({
  image: imagePayloadSchema,
});

export const avatarEmojiBodySchema = z.object({
  emoji: z.string().min(1).max(32),
});
