"use client";

import { useMemo, useState } from "react";
import { ApiError } from "../../lib/api.js";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { useNotifications } from "../../lib/notifications/NotificationsContext.jsx";
import { Avatar } from "../Avatar.jsx";
import { Button } from "../Button.jsx";

/**
 * @typedef {'idle' | 'inviting' | 'invited' | 'failed'} InviteButtonState
 */

/**
 * @param {{
 *   gameSlug: string,
 *   roomCode: string,
 *   hostId: string,
 *   localUserId: string,
 *   playerUserIds: string[],
 * }} props
 */
export function LobbyInviteFriends({ gameSlug, roomCode, hostId, localUserId, playerUserIds }) {
  const { friends } = useFriends();
  const { sendInvite } = useNotifications();
  /** @type {[Record<string, InviteButtonState>, React.Dispatch<React.SetStateAction<Record<string, InviteButtonState>>>]} */
  const [states, setStates] = useState({});
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const isHost = String(hostId) === String(localUserId);
  const inRoom = useMemo(() => new Set(playerUserIds.map(String)), [playerUserIds]);

  const inviteTargets = useMemo(() => {
    return friends
      .filter((f) => f.online && f.userId !== localUserId && !inRoom.has(f.userId))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [friends, localUserId, inRoom]);

  if (!isHost || !roomCode) return null;

  const handleInvite = async (recipientId) => {
    setError(null);
    setStates((prev) => ({ ...prev, [recipientId]: "inviting" }));
    try {
      await sendInvite(recipientId, gameSlug, roomCode);
      setStates((prev) => ({ ...prev, [recipientId]: "invited" }));
    } catch (e) {
      setStates((prev) => ({ ...prev, [recipientId]: "failed" }));
      setError(e instanceof ApiError ? e.user_message || e.message : "Could not send invite");
    }
  };

  return (
    <section className="rounded-2xl border border-muted-bright/40 bg-muted-bright/15 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-foreground">Invite friends</h3>
          <p className="text-[11px] font-semibold text-muted">
            {inviteTargets.length > 0
              ? `${inviteTargets.length} online friend${inviteTargets.length === 1 ? "" : "s"} available`
              : "No online friends available right now"}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs font-semibold text-error">{error}</p>
      ) : null}

      {inviteTargets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {inviteTargets.map((friend) => {
            const state = states[friend.userId] ?? "idle";
            return (
              <li
                key={friend.userId}
                className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2 ring-1 ring-foreground/5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar username={friend.username} src={friend.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{friend.username}</p>
                    <p className="text-[10px] font-semibold text-accent-mint">Online</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={state === "invited" ? "ghost" : "secondary"}
                  className="px-3 py-1.5 text-xs"
                  disabled={state === "inviting" || state === "invited"}
                  onClick={() => void handleInvite(friend.userId)}
                >
                  {state === "inviting"
                    ? "Inviting…"
                    : state === "invited"
                      ? "Invited"
                      : state === "failed"
                        ? "Retry"
                        : "Invite"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
