"use client";

import { Users } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";
import { tabooTeamColors } from "../../../../lib/taboo/variants.js";

/**
 * @param {{ activeTeam?: 'A' | 'B' | null }} props
 */
export function TabooTurnBadge({ activeTeam = "A" }) {
  const teamStyle = tabooTeamColors(activeTeam === "B" ? "B" : "A");
  const label = activeTeam === "B" ? "Team Beta's Turn" : "Team Alpha's Turn";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
        teamStyle.pillBg,
        teamStyle.pillBorder,
        teamStyle.pillText,
      )}
    >
      <Users className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
