import { resolveUserAvatar } from './resolveUserAvatar.js';

/**
 * @param {{ data?: { avatarUrl?: string | null, avatarEmoji?: string | null } }} socket
 */
export function avatarFromSocket(socket) {
  const avatarUrl =
    typeof socket?.data?.avatarUrl === 'string' && socket.data.avatarUrl.trim()
      ? socket.data.avatarUrl.trim()
      : null;
  const avatarEmoji =
    typeof socket?.data?.avatarEmoji === 'string' && socket.data.avatarEmoji.trim()
      ? socket.data.avatarEmoji.trim()
      : null;
  return { avatarUrl, avatarEmoji };
}

/**
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null } | null | undefined} user
 */
export function avatarFromUser(user) {
  return resolveUserAvatar(user ?? {});
}

/**
 * @param {Record<string, unknown>} player
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null }} source
 */
export function mergeAvatarIntoPlayer(player, source) {
  player.avatarUrl = source.avatarUrl ?? null;
  player.avatarEmoji = source.avatarEmoji ?? null;
  return player;
}

/**
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null } | null | undefined} p
 */
export function lobbyPlayerAvatarFields(p) {
  return {
    avatarUrl: p?.avatarUrl ?? null,
    avatarEmoji: p?.avatarEmoji ?? null,
  };
}

/**
 * @param {{
 *   userId: string,
 *   username: string,
 *   socket: { data?: { avatarUrl?: string | null, avatarEmoji?: string | null } },
 *   extra?: Record<string, unknown>,
 * }} params
 */
export function baseLobbyPlayer({ userId, username, socket, extra = {} }) {
  return {
    userId,
    username,
    ...avatarFromSocket(socket),
    ...extra,
  };
}
