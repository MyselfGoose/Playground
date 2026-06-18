"use client";

import { Eye, MessageCircle, Mic } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";

const ROLE_BADGES = {
  clue_giver: {
    icon: Mic,
    label: "You're the Clue Giver",
    className: "bg-taboo-team-a-soft text-taboo-team-a-text shadow-[var(--taboo-team-a-glow)]",
  },
  teammate_guesser: {
    icon: MessageCircle,
    label: "You're Guessing",
    className: "bg-taboo-success-soft text-taboo-success",
  },
  opponent_observer: {
    icon: Eye,
    label: "Monitoring for Taboo",
    className: "bg-taboo-danger-soft text-taboo-danger-text",
  },
  spectator: {
    icon: Eye,
    label: "Watching",
    className: "taboo-surface-inset text-taboo-text-faint",
  },
};

/**
 * @param {{ viewerRole?: string }} props
 */
export function TabooRoleBadge({ viewerRole = "spectator" }) {
  const badge = ROLE_BADGES[viewerRole] || ROLE_BADGES.spectator;
  const Icon = badge.icon;

  return (
    <div
      className={cn(
        "mx-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium",
        badge.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {badge.label}
    </div>
  );
}
