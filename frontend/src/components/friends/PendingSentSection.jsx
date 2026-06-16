"use client";

import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { Avatar } from "../Avatar.jsx";
import { Button } from "../Button.jsx";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";

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
        <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-foreground/50">Sent</h3>
        <p className="px-1 text-xs font-semibold text-muted">No outgoing requests.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-foreground/50">Sent</h3>
      {error ? <p className="mb-2 px-1 text-xs font-semibold text-error">{error}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => {
          const declined = item.status === "declined";
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                declined ? "border-foreground/10 bg-muted-bright/10 opacity-80" : "border-foreground/10 bg-muted-bright/20"
              }`}
            >
              <Avatar username={item.to.username} src={item.to.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{item.to.username}</p>
                <p className="text-[10px] font-semibold text-muted">
                  {declined ? "Request declined" : "Pending"}
                </p>
              </div>
              {declined ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-2 py-1 text-[10px]"
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
                >
                  Send again
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 px-2 py-1 text-[10px]"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    void cancelRequest(item.id).finally(() => setBusyId(null));
                  }}
                >
                  Cancel
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
