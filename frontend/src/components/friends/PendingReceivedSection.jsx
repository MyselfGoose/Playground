"use client";

import { useState } from "react";
import { Avatar } from "../Avatar.jsx";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { FriendIconButton } from "./FriendIconButton.jsx";

/**
 * @param {{ items: Array<{ id: string, from: { userId: string, username: string, avatarUrl: string } }> }} props
 */
export function PendingReceivedSection({ items }) {
  const { acceptRequest, declineRequest } = useFriends();
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));

  if (!items.length) {
    return (
      <section>
        <h3 className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/50">Received</h3>
        <p className="rounded-xl border border-dashed border-foreground/15 bg-muted-bright/10 px-3 py-4 text-center text-xs font-semibold text-muted">
          No incoming requests.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/50">Received</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-muted-bright/20 px-2 py-1.5"
          >
            <Avatar username={item.from.username} src={item.from.avatarUrl} size="sm" />
            <p className="min-w-0 flex-1 truncate text-sm text-foreground">
              <span className="font-bold">{item.from.username}</span>
              <span className="font-semibold text-muted"> wants to be friends</span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <FriendIconButton
                kind="accept"
                label={`Accept friend request from ${item.from.username}`}
                disabled={busyId === item.id}
                onClick={() => {
                  setBusyId(item.id);
                  void acceptRequest(item.id).finally(() => setBusyId(null));
                }}
              />
              <FriendIconButton
                kind="decline"
                label={`Decline friend request from ${item.from.username}`}
                disabled={busyId === item.id}
                onClick={() => {
                  setBusyId(item.id);
                  void declineRequest(item.id).finally(() => setBusyId(null));
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
