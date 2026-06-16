"use client";

import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { Avatar } from "../Avatar.jsx";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { FriendIconButton } from "./FriendIconButton.jsx";

/**
 * @param {{
 *   items: Array<{
 *     id: string,
 *     to: { userId: string, username: string, avatarUrl: string },
 *     status: 'pending' | 'declined',
 *     respondedAt?: string | null,
 *   }>,
 * }} props
 */
export function PendingSentSection({ items }) {
  const { cancelRequest, sendRequest } = useFriends();
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState("");

  if (!items.length) {
    return (
      <section>
        <h3 className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/50">Sent</h3>
        <p className="rounded-xl border border-dashed border-foreground/15 bg-muted-bright/10 px-3 py-4 text-center text-xs font-semibold text-muted">
          No outgoing requests.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/50">Sent</h3>
      {error ? <p className="mb-2 rounded-lg border border-error/30 bg-error/10 px-2.5 py-2 text-xs font-semibold text-error">{error}</p> : null}
      <ul className="space-y-1.5">
        {items.map((item) => {
          const declined = item.status === "declined";
          return (
            <li
              key={item.id}
              className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                declined ? "border-foreground/10 bg-muted-bright/10 opacity-90" : "border-foreground/10 bg-muted-bright/20"
              }`}
            >
              <Avatar username={item.to.username} src={item.to.avatarUrl} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                <span className="font-bold">{item.to.username}</span>
                <span className={`font-semibold ${declined ? "text-foreground/55" : "text-muted"}`}>
                  {declined ? " · declined" : " · pending"}
                </span>
              </p>
              {declined ? (
                <FriendIconButton
                  kind="resend"
                  label={`Send friend request again to ${item.to.username}`}
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    setError("");
                    void sendRequest(item.to.username)
                      .catch((e) =>
                        setError(e instanceof ApiError ? e.user_message || e.message : "Could not resend"),
                      )
                      .finally(() => setBusyId(null));
                  }}
                />
              ) : (
                <FriendIconButton
                  kind="cancel"
                  label={`Cancel friend request to ${item.to.username}`}
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    void cancelRequest(item.id).finally(() => setBusyId(null));
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
