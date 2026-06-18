"use client";

import { Crown } from "lucide-react";
import { Avatar } from "../../../../components/Avatar.jsx";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   avatarUrl?: string | null,
 *   avatarEmoji?: string | null,
 *   team?: 'A' | 'B' | null,
 *   ready?: boolean,
 *   connected?: boolean,
 *   isHost?: boolean,
 *   isYou?: boolean,
 * }} props
 */
export function TabooPlayerRow({
  name,
  avatarUrl = null,
  avatarEmoji = null,
  team = null,
  ready = false,
  connected = true,
  isHost = false,
  isYou = false,
}) {
  const displayName = name?.trim() || "Player";
  const fullLabel = isYou ? `${displayName} (You)` : displayName;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5",
        team === "B" ? "taboo-roster-player-b" : "taboo-roster-player-a",
      )}
      title={fullLabel}
    >
      <div className="relative shrink-0">
        <Avatar
          username={displayName}
          src={avatarUrl ?? undefined}
          emoji={avatarEmoji ?? undefined}
          size="sm"
        />
        {isHost ? (
          <Crown
            className="absolute -right-1 -top-1 h-3.5 w-3.5 text-taboo-warning drop-shadow-sm"
            aria-label="Host"
          />
        ) : null}
      </div>

      <span className="flex-1 whitespace-nowrap text-sm font-semibold text-taboo-text">
        {displayName}
        {isYou ? <span className="font-medium text-taboo-text-muted"> (You)</span> : null}
      </span>

      {connected ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] leading-none whitespace-nowrap",
            ready ? "taboo-ready-pill-ready" : "taboo-ready-pill-waiting",
          )}
        >
          {ready ? "Ready" : "Not Ready"}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full border border-taboo-border bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-taboo-text-muted">
          Offline
        </span>
      )}
    </li>
  );
}
