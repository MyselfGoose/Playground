"use client";

import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{ message: string, className?: string }} props
 */
export function TabooErrorBanner({ message, className }) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-xl bg-taboo-danger-soft px-4 py-3 text-sm font-semibold text-taboo-danger-text",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      role="alert"
    >
      {message}
    </p>
  );
}
