/**
 * @param {{
 *   userId?: string,
 *   id?: string,
 *   username?: string,
 *   name?: string,
 *   avatarUrl?: string | null,
 *   avatarEmoji?: string | null,
 *   ready?: boolean,
 *   connected?: boolean,
 *   presenceStatus?: string,
 *   graceEndsAtMs?: number | null,
 *   graceSecondsRemaining?: number,
 *   team?: string,
 *   teamId?: string,
 * }} player
 * @param {{ hostId?: string | null }} [options]
 */
export function mapPartyPlayer(player, { hostId = null } = {}) {
  const id = String(player.userId ?? player.id ?? "");
  const name = player.username ?? player.name ?? "Player";
  return {
    id,
    name,
    avatarUrl: player.avatarUrl ?? null,
    avatarEmoji: player.avatarEmoji ?? null,
    ready: Boolean(player.ready),
    connected: player.connected !== false,
    presenceStatus: player.presenceStatus,
    graceEndsAtMs: player.graceEndsAtMs,
    graceSecondsRemaining: player.graceSecondsRemaining,
    isHost: hostId != null && id === hostId,
    team: player.team ?? player.teamId,
  };
}
