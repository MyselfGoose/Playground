/**
 * @param {number | undefined | null} createdAt
 */
export function roomAgeMs(createdAt) {
  if (!createdAt) return 0;
  return Math.max(0, Date.now() - createdAt);
}

/**
 * @param {{
 *   code: string,
 *   game: string,
 *   hostId: string,
 *   hostUsername?: string | null,
 *   playerCount: number,
 *   phase: string,
 *   createdAt?: number | null,
 * }} row
 */
export function toRoomSummary(row) {
  const createdAt = row.createdAt ?? null;
  return {
    code: row.code,
    game: row.game,
    hostId: row.hostId,
    hostUsername: row.hostUsername ?? null,
    playerCount: row.playerCount,
    phase: row.phase,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    ageMs: roomAgeMs(createdAt),
  };
}

/**
 * @param {{
 *   code: string,
 *   game: string,
 *   hostId: string,
 *   hostUsername?: string | null,
 *   phase: string,
 *   players: Array<{ userId: string, username: string, ready?: boolean, score?: number, team?: string }>,
 *   meta?: Record<string, unknown>,
 * }} row
 */
export function toRoomDetail(row) {
  return {
    code: row.code,
    game: row.game,
    hostId: row.hostId,
    hostUsername: row.hostUsername ?? null,
    phase: row.phase,
    players: row.players,
    meta: row.meta ?? {},
  };
}
