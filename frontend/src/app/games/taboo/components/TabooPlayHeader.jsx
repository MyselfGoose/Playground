"use client";

import { LogOut } from "lucide-react";

/**
 * @param {{
 *   roundNumber: number,
 *   totalRounds: number,
 *   onLeave: () => void,
 * }} props
 */
export function TabooPlayHeader({ roundNumber, totalRounds, onLeave }) {
  return (
    <div className="mb-3 flex items-center justify-between px-4 pt-3">
      <button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-2 text-taboo-text-muted transition-colors hover:text-taboo-text"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-sm font-medium">Leave</span>
      </button>
      <p className="text-sm font-semibold text-taboo-text-muted">
        Round {roundNumber}/{totalRounds}
      </p>
    </div>
  );
}
