import { z } from "zod";

export const tabooCreateRoomSchema = z.object({
  roundCount: z.number().int().min(1).max(10).optional(),
  roundDurationSeconds: z.number().int().min(30).max(180).optional(),
  categoryMode: z.enum(["all", "single"]).optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
});

export const tabooJoinRoomSchema = z.object({
  code: z.string().min(4).max(8),
});

export const tabooSetReadySchema = z.object({
  ready: z.boolean(),
});

export const tabooChangeTeamSchema = z.object({
  team: z.enum(["A", "B"]),
});

export const tabooSubmitGuessSchema = z.object({
  guess: z.string().min(1).max(120),
});

export const tabooReviewVoteSchema = z.object({
  vote: z.enum(["fair", "not_fair"]),
});

export const tabooSetCategoriesSchema = z.object({
  categoryMode: z.enum(["all", "single"]),
  categoryIds: z.array(z.number().int().positive()).optional(),
});
