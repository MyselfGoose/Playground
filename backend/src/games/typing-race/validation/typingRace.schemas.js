import { z } from "zod";
import { TYPING_RACE_ROOM_CODE_LEN } from "../constants.js";

export const typingJoinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((d) => d.length === TYPING_RACE_ROOM_CODE_LEN, "Invalid room code"),
});

export const typingSetReadySchema = z.object({
  ready: z.boolean(),
});

export const typingProgressSchema = z.object({
  cursorDisplay: z.number().int().min(0).max(200_000),
  cursor: z.number().int().min(0).max(200_000),
  errorLen: z.number().int().min(0).max(500).optional(),
  wpm: z.number().min(0).max(500).optional(),
  clientTs: z.number().optional(),
});
