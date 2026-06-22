"use client";

import { LogOut } from "lucide-react";

/**
 * @param {{ onLeave: () => void }} props
 */
export function FibbagePlayHeader({ onLeave }) {
  return (
    <div className="flex items-center px-4 pt-3">
      <button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-2 text-[var(--fibbage-text-muted)] transition-colors hover:text-[var(--fibbage-text)]"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-sm font-medium">Leave</span>
      </button>
    </div>
  );
}
