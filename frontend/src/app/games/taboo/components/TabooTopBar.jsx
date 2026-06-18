"use client";

import { TabooLinkPill } from "../ui/index.js";

/**
 * @param {{
 *   className?: string,
 *   showStats?: boolean,
 *   showAllGames?: boolean,
 *   rightSlot?: import("react").ReactNode,
 * }} props
 */
export function TabooTopBar({
  className = "",
  showStats = true,
  showAllGames = true,
  rightSlot,
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {showStats ? <TabooLinkPill href="/leaderboard">Stats</TabooLinkPill> : null}
        {showAllGames ? <TabooLinkPill href="/games">All games</TabooLinkPill> : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
