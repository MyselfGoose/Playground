/** @typedef {'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'} GameInviteStatus */

/**
 * @typedef {{
 *   id: string,
 *   gameSlug: string,
 *   roomCode: string,
 *   status: GameInviteStatus,
 *   readAt?: string | null,
 *   expiresAt?: string,
 *   respondedAt?: string | null,
 *   createdAt?: string,
 *   gameTitle: string,
 *   gameEmoji: string,
 *   inviter: { userId: string, username: string, avatarUrl: string },
 *   joinPath: string,
 * }} GameInviteEntry
 */

/**
 * @param {GameInviteEntry} invite
 */
export function isUnreadInvite(invite) {
  return invite.status === "pending" && !invite.readAt;
}

/**
 * @param {GameInviteEntry} invite
 */
export function isActionableInvite(invite) {
  return invite.status === "pending";
}

/**
 * @param {GameInviteEntry[]} invites
 */
export function countUnreadInvites(invites) {
  return invites.filter(isUnreadInvite).length;
}

/**
 * @param {GameInviteEntry[]} invites
 */
export function partitionInvites(invites) {
  const unread = [];
  const earlier = [];
  for (const invite of invites) {
    if (isUnreadInvite(invite)) unread.push(invite);
    else earlier.push(invite);
  }
  return { unread, earlier };
}

/**
 * @param {GameInviteEntry[]} invites
 * @param {GameInviteEntry} invite
 */
export function upsertInvite(invites, invite) {
  const next = invites.filter((i) => i.id !== invite.id);
  return [invite, ...next];
}

/**
 * @param {GameInviteEntry[]} invites
 * @param {string} inviteId
 * @param {Partial<GameInviteEntry>} patch
 */
export function patchInvite(invites, inviteId, patch) {
  return invites.map((i) => (i.id === inviteId ? { ...i, ...patch } : i));
}

/**
 * @param {GameInviteEntry[]} invites
 * @param {string} [inviteId]
 */
export function markInvitesRead(invites, inviteId) {
  const now = new Date().toISOString();
  return invites.map((i) => {
    if (i.status !== "pending" || i.readAt) return i;
    if (inviteId && i.id !== inviteId) return i;
    return { ...i, readAt: now };
  });
}

/**
 * @param {GameInviteStatus} status
 */
export function inviteStatusLabel(status) {
  switch (status) {
    case "accepted":
      return "Joined";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return null;
  }
}
