"use client";

import { useState } from "react";
import { Card } from "../ui/Card.jsx";
import { useNotifications } from "../../lib/notifications/NotificationsContext.jsx";
import { partitionInvites } from "../../lib/notifications/notificationsStateHelpers.js";
import { GameInviteRow } from "./GameInviteRow.jsx";
import { NotificationSectionDivider } from "./NotificationSectionDivider.jsx";

/**
 * @param {{ onClose: () => void }} props
 */
export function NotificationsPanel({ onClose }) {
  const { invites, loadingInvites, invitesError, acceptInvite, declineInvite } = useNotifications();
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const { unread, earlier } = partitionInvites(invites);
  const showDivider = unread.length > 0 && earlier.length > 0;

  const handleAccept = async (inviteId) => {
    setBusyId(inviteId);
    try {
      await acceptInvite(inviteId);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (inviteId) => {
    setBusyId(inviteId);
    try {
      await declineInvite(inviteId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden p-0 shadow-[var(--shadow-lg)] ring-1 ring-foreground/10">
      <div className="border-b border-foreground/10 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-foreground">Notifications</h2>
            <p className="text-[11px] font-semibold text-muted">
              {invites.length === 0
                ? "No notifications"
                : `${invites.length} notification${invites.length === 1 ? "" : "s"}`}
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
      </div>

      <div className="max-h-[min(70vh,28rem)] overflow-y-auto px-2 py-2">
        {loadingInvites && invites.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm font-semibold text-muted">Loading…</p>
        ) : invitesError ? (
          <p className="px-2 py-4 text-center text-sm font-semibold text-error">{invitesError}</p>
        ) : invites.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-bold text-foreground/70">You&apos;re all caught up</p>
            <p className="mt-1 text-xs font-semibold text-muted">Game invites will appear here</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {unread.map((invite) => (
              <GameInviteRow
                key={invite.id}
                invite={invite}
                busy={busyId === invite.id}
                onAccept={() => void handleAccept(invite.id)}
                onDecline={() => void handleDecline(invite.id)}
              />
            ))}
            {showDivider ? <NotificationSectionDivider label="Earlier" /> : null}
            {earlier.map((invite) => (
              <GameInviteRow
                key={invite.id}
                invite={invite}
                busy={busyId === invite.id}
                onAccept={() => void handleAccept(invite.id)}
                onDecline={() => void handleDecline(invite.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
