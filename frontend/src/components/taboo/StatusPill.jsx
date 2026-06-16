"use client";

import { cn } from "../../lib/taboo/cn.js";

const variants = {
  success: "border border-taboo-success/30 bg-taboo-success-soft text-taboo-success",
  warning: "border border-taboo-warning/35 bg-taboo-warning-soft text-taboo-warning",
  danger: "border border-taboo-danger/30 bg-taboo-danger-soft text-taboo-danger-text",
  neutral: "border border-taboo-border bg-white/[0.04] text-taboo-text-muted",
};

export function StatusPill({ variant = "neutral", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant] || variants.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
