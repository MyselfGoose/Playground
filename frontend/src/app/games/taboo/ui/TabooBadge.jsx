"use client";

import { cn } from "../../../../lib/taboo/cn.js";

const variantClasses = {
  default: "taboo-surface-inset text-taboo-text-muted",
  success: "bg-taboo-success-soft text-taboo-success",
  warning: "bg-taboo-warning-soft text-taboo-warning",
  danger: "bg-taboo-danger-soft text-taboo-danger-text",
  accent: "bg-taboo-accent-soft text-taboo-accent-hover",
  teamA: "bg-taboo-team-a-soft text-taboo-team-a-text",
  teamB: "bg-taboo-team-b-soft text-taboo-team-b-text",
  host: "bg-taboo-warning-soft text-taboo-warning",
  offline: "bg-white/[0.04] text-taboo-text-faint",
};

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   variant?: keyof typeof variantClasses,
 *   className?: string,
 * }} props
 */
export function TabooBadge({ children, variant = "default", className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
