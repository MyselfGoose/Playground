import { z } from 'zod';
import { usernameFieldSchema } from './auth.schemas.js';

export const sendFriendRequestBodySchema = z.object({
  username: usernameFieldSchema,
});

export const friendUserIdParamSchema = z.object({
  userId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user id'),
});

export const friendRequestIdParamSchema = z.object({
  requestId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid request id'),
});

export const lookupUsernameParamSchema = z.object({
  username: usernameFieldSchema,
});
