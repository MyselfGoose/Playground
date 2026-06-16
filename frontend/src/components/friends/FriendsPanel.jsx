"use client";

import { useState } from "react";
import { Card } from "../ui/Card.jsx";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { AddFriendForm } from "./AddFriendForm.jsx";
import { FriendRow } from "./FriendRow.jsx";
import { PendingReceivedSection } from "./PendingReceivedSection.jsx";
import { PendingSentSection } from "./PendingSentSection.jsx";

/** @typedef {'online' | 'all' | 'pending'} FriendsTab */

const TABS = /** @type {const} */ ([
  { id: "online", label: "Online" },
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
]);

/**
 * @param {{ onClose: () => void }} props
 */
export function FriendsPanel({ onClose }) {
  const { friends, pendingReceived, pendingSent, loadingFriends, friendsError } = useFriends();
  const [tab, setTab] = useState(/** @type {FriendsTab} */ ("online"));

  const onlineFriends = friends.filter((f) => f.online);
  const pendingCount = pendingReceived.length + pendingSent.length;
  const list =
    tab === "online" ? onlineFriends : tab === "all" ? friends : [];

  return (
    <Card variant="elevated" className="overflow-hidden p-0 shadow-[var(--shadow-lg)] ring-1 ring-foreground/10">
      <div className="border-b border-foreground/10 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-foreground">Friends</h2>
            <p className="text-[11px] font-semibold text-muted">
              {friends.length} friend{friends.length === 1 ? "" : "s"}
              {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-bold text-muted transition-colors hover:bg-muted-bright/40 hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="mt-2.5 flex gap-1 rounded-xl bg-muted-bright/30 p-1" role="tablist" aria-label="Friends views">
          {TABS.map((t) => {
            const active = tab === t.id;
            const badge =
              t.id === "pending" ? pendingCount : t.id === "online" ? onlineFriends.length : friends.length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                  active ? "bg-background text-foreground shadow-sm" : "text-foreground/55 hover:text-foreground"
                }`}
              >
                {t.label}
                {badge > 0 ? <span className="ml-1 text-[10px] font-semibold text-muted">({badge})</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[min(65vh,22rem)] overflow-y-auto px-3 py-2.5">
        {tab !== "pending" ? <AddFriendForm className="mb-3" /> : null}

        {friendsError ? (
          <p className="mb-3 rounded-lg border border-error/30 bg-error/10 px-2.5 py-2 text-xs font-semibold text-error">
            {friendsError}
          </p>
        ) : null}

        {loadingFriends && friends.length === 0 && tab !== "pending" ? (
          <p className="px-2 py-6 text-center text-xs font-semibold text-muted">Loading friends…</p>
        ) : null}

        {tab === "pending" ? (
          <div className="space-y-4">
            <AddFriendForm />
            <PendingReceivedSection items={pendingReceived} />
            <PendingSentSection items={pendingSent} />
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs font-semibold text-muted">
            {tab === "online" ? "No friends online right now." : "No friends yet — add someone by username."}
          </p>
        ) : (
          <ul className="space-y-1">
            {list.map((friend) => (
              <FriendRow key={friend.userId} friend={friend} onNavigate={onClose} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
