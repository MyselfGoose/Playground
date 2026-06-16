import { buildInviteJoinPath, getGameSlugMeta } from "../party/gameSlugMeta.js";
import { persistLastRoomCode } from "../session/RoomSession.js";

/**
 * @param {import('next/navigation').AppRouterInstance} router
 * @param {{ gameSlug: string, roomCode: string, joinPath?: string }} invite
 * @param {string | null | undefined} userId
 */
export function navigateToGameInvite(router, invite, userId) {
  const meta = getGameSlugMeta(invite.gameSlug);
  const path = buildInviteJoinPath(invite.gameSlug, invite.roomCode);
  if (meta?.gameId && userId) {
    persistLastRoomCode(meta.gameId, invite.roomCode, userId);
  }
  router.push(path);
}
