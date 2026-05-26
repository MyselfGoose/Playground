/**
 * Best-effort JSDoc contracts for multiplayer room snapshots (client-side).
 * Server remains authoritative; shapes may include additional fields.
 */

/**
 * @typedef {Object} RoomPlayerBase
 * @property {string} userId
 * @property {string} [username]
 * @property {boolean} [ready]
 * @property {boolean} [connected]
 */

/**
 * @typedef {Object} RoomSnapshotBase
 * @property {string} code
 * @property {number} [stateVersion]
 * @property {string} [hostId]
 * @property {RoomPlayerBase[]} [players]
 */

/**
 * @typedef {RoomSnapshotBase & {
 *   game?: {
 *     phase?: string;
 *     scores?: Record<string, number>;
 *   } | null;
 *   lobby?: {
 *     countdownEndsAt?: number | null;
 *     lastScores?: Record<string, number> | null;
 *   };
 *   me?: { userId?: string; permissions?: Record<string, boolean> };
 * }} HangmanRoom
 */

/**
 * @typedef {RoomSnapshotBase & {
 *   phase?: string;
 *   roomCode?: string;
 *   serverNow?: number;
 *   players?: Array<RoomPlayerBase & { cursor?: number; wpm?: number; rank?: number | null }>;
 * }} TypingRaceRoom
 */

/**
 * @typedef {RoomSnapshotBase & {
 *   hostUserId?: string;
 *   state?: string;
 *   mode?: string;
 *   maxRounds?: number;
 *   players?: RoomPlayerBase[];
 *   startingEndsAt?: number | null;
 *   timerEndsAt?: number | null;
 *   betweenRoundsEndsAt?: number | null;
 *   roundPhase?: string;
 *   countdownTriggeredByUserId?: string | null;
 *   results?: { rounds?: unknown[]; evaluationSource?: 'gemini' | 'fallback' };
 * }} NpatRoom
 */

/**
 * @typedef {RoomSnapshotBase & {
 *   settings?: { maxRounds?: number; packs?: string[] };
 *   game?: {
 *     status?: string;
 *     roundIndex?: number;
 *     judgeUserId?: string;
 *     hand?: unknown[];
 *   } | null;
 *   me?: { userId?: string; score?: number };
 *   permissions?: Record<string, boolean>;
 * }} CahRoom
 */

/**
 * @typedef {RoomSnapshotBase & {
 *   serverNow?: number;
 *   settings?: Record<string, unknown>;
 *   game?: {
 *     status?: string;
 *     roundNumber?: number;
 *     totalRounds?: number;
 *   } | null;
 * }} TabooRoom
 */

export {};
