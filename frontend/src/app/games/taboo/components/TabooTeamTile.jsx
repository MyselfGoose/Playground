"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   teamLabel: string,
 *   team: 'A' | 'B',
 *   playerCount: number,
 *   selected: boolean,
 *   onSelect: () => void,
 * }} props
 */
export function TabooTeamTile({ teamLabel, team, playerCount, selected, onSelect }) {
  const isTeamA = team === "A";
  const teamStyle = isTeamA
    ? { dot: "bg-taboo-team-a" }
    : { dot: "bg-taboo-team-b" };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative rounded-xl p-3.5 text-left transition-all duration-200",
        selected
          ? isTeamA
            ? "taboo-team-tile-a-selected"
            : "taboo-team-tile-b-selected"
          : "taboo-team-tile-idle",
        !selected && (isTeamA ? "hover:border-taboo-team-a/30" : "hover:border-taboo-team-b/30"),
      )}
    >
      {selected ? (
        <div className={cn("absolute right-2.5 top-2.5 h-2 w-2 rounded-full", teamStyle.dot)} />
      ) : null}
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isTeamA ? "taboo-team-icon-a" : "taboo-team-icon-b")}>
          <Users className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold text-taboo-text">{teamLabel}</span>
      </div>
      <p className="pl-[2.625rem] text-xs text-taboo-text-muted">
        {playerCount} player{playerCount === 1 ? "" : "s"}
      </p>
    </motion.button>
  );
}
