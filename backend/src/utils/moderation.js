/**
 * @param {{ moderation?: { status?: string, expiresAt?: Date | string | null } | null } | null | undefined} user
 * @returns {boolean}
 */
export function isModerationBlocked(user) {
  const mod = user?.moderation;
  if (!mod || mod.status === 'none' || !mod.status) return false;
  if (mod.status === 'banned') return true;
  if (mod.status === 'suspended') {
    if (!mod.expiresAt) return true;
    const expires = mod.expiresAt instanceof Date ? mod.expiresAt : new Date(mod.expiresAt);
    if (Number.isNaN(expires.getTime())) return true;
    return expires.getTime() > Date.now();
  }
  return false;
}
