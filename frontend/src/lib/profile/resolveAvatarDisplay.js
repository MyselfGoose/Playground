/**
 * @param {{ avatarUrl?: string | null, avatarEmoji?: string | null, src?: string | null, emoji?: string | null }} props
 * @returns {{ src: string | null, emoji: string | null }}
 */
export function resolveAvatarDisplay({ avatarUrl, avatarEmoji, src, emoji } = {}) {
  const resolvedEmoji =
    typeof emoji === "string" && emoji.trim()
      ? emoji.trim()
      : typeof avatarEmoji === "string" && avatarEmoji.trim()
        ? avatarEmoji.trim()
        : null;
  if (resolvedEmoji) {
    return { src: null, emoji: resolvedEmoji };
  }
  const resolvedSrc =
    typeof src === "string" && src.trim()
      ? src.trim()
      : typeof avatarUrl === "string" && avatarUrl.trim()
        ? avatarUrl.trim()
        : null;
  return { src: resolvedSrc, emoji: null };
}
