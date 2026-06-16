"use client";

import { motion } from "framer-motion";
import { Avatar } from "../Avatar.jsx";
import { Button } from "../Button.jsx";
import {
  inviteStatusLabel,
  isActionableInvite,
  isUnreadInvite,
} from "../../lib/notifications/notificationsStateHelpers.js";

/**
 * @param {{ invite: import('../../lib/notifications/notificationsStateHelpers.js').GameInviteEntry, onAccept: () => void, onDecline: () => void, busy?: boolean }} props
 */
export function GameInviteRow({ invite, onAccept, onDecline, busy = false }) {
  const unread = isUnreadInvite(invite);
  const actionable = isActionableInvite(invite);
  const statusLabel = inviteStatusLabel(invite.status);

  const timeLabel = invite.createdAt
    ? new Date(invite.createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl px-3 py-3 transition-colors ${
        unread
          ? "border-l-4 border-primary bg-primary/5"
          : actionable
            ? "bg-muted-bright/20"
            : "bg-muted-bright/10 opacity-75"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl leading-none" aria-hidden>
          {invite.gameEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm ${unread ? "font-black text-foreground" : "font-bold text-foreground/90"}`}>
                {invite.gameTitle}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Avatar username={invite.inviter.username} src={invite.inviter.avatarUrl} size="sm" />
                <p className="truncate text-xs font-semibold text-muted">
                  <span className="text-foreground/80">{invite.inviter.username}</span> invited you
                </p>
              </div>
            </div>
            {unread ? (
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            ) : null}
          </div>
          {timeLabel ? (
            <p className="mt-1 text-[10px] font-semibold text-foreground/45">{timeLabel}</p>
          ) : null}
          {actionable ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="px-3 py-1.5 text-xs" disabled={busy} onClick={onAccept}>
                Accept
              </Button>
              <Button type="button" className="px-3 py-1.5 text-xs" variant="ghost" disabled={busy} onClick={onDecline}>
                Decline
              </Button>
            </div>
          ) : statusLabel ? (
            <span className="mt-2 inline-flex rounded-full bg-muted-bright/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted">
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}
