"use client";

import { useState } from "react";
import { Avatar } from "../Avatar.jsx";
import { Button } from "../Button.jsx";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";

/**
 * @param {{ items: Array<{ id: string, from: { userId: string, username: string, avatarUrl: string } }> }} props
 */
export function PendingReceivedSection({ items }) {
  const { acceptRequest, declineRequest } = useFriends();
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));

  if (!items.length) {
    return (
      <section>
        <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-foreground/50">Received</h3>
        <p className="px-1 text-xs font-semibold text-muted">No incoming requests.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-foreground/50">Received</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-muted-bright/20 px-3 py-2.5"
          >
            <Avatar username={item.from.username} src={item.from.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{item.from.username}</p>
              <p className="text-[10px] font-semibold text-muted">Wants to be friends</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="primary"
                className="px-2 py-1 text-[10px]"
                disabled={busyId === item.id}
                onClick={() => {
                  setBusyId(item.id);
                  void acceptRequest(item.id).finally(() => setBusyId(null));
                }}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-[10px]"
                disabled={busyId === item.id}
                onClick={() => {
                  setBusyId(item.id);
                  void declineRequest(item.id).finally(() => setBusyId(null));
                }}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
