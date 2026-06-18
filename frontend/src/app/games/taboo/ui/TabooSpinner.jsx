"use client";

import { Loader2 } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{ className?: string, size?: "sm" | "md", label?: string }} props
 */
export function TabooSpinner({ className, size = "md", label = "Loading" }) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className={cn("flex flex-col items-center gap-2", className)} role="status" aria-live="polite">
      <Loader2 className={cn("animate-spin text-taboo-accent", sizeClass)} aria-hidden />
      {label ? <span className="text-sm font-medium text-taboo-text-muted">{label}</span> : null}
    </div>
  );
}

/**
 * @param {{ className?: string }} props
 */
export function TabooDivider({ className }) {
  return <div className={cn("taboo-divider", className)} role="separator" />;
}
