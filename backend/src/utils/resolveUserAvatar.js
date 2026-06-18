/**
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null }} user
 * @returns {{ avatarUrl: string | null, avatarEmoji: string | null }}
 */
export function resolveUserAvatar(user) {
  const avatarUrl =
    typeof user?.avatarUrl === 'string' && user.avatarUrl.trim().length > 0
      ? user.avatarUrl.trim()
      : null;
  const avatarEmoji =
    typeof user?.avatarEmoji === 'string' && user.avatarEmoji.trim().length > 0
      ? user.avatarEmoji.trim()
      : null;
  return { avatarUrl, avatarEmoji };
}

/**
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null, username?: string }} user
 */
export function userAvatarFields(user) {
  const { avatarUrl, avatarEmoji } = resolveUserAvatar(user);
  return {
    avatarUrl,
    avatarEmoji,
  };
}
