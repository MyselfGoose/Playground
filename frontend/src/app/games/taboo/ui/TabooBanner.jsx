"use client";

import { cn } from "../../../../lib/taboo/cn.js";

const variantClasses = {
  info: "bg-taboo-accent-soft text-taboo-accent-hover",
  success: "bg-taboo-success-soft text-taboo-success",
  warning: "bg-taboo-warning-soft text-taboo-warning",
  danger: "bg-taboo-danger-soft text-taboo-danger-text",
};

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   variant?: keyof typeof variantClasses,
 *   className?: string,
 *   role?: string,
 * }} props
 */
export function TabooBanner({ children, variant = "info", className, role = "status" }) {
  return (
    <div
      role={role}
      className={cn(
        "relative z-20 px-4 py-2 text-center text-sm font-medium transition-colors duration-200",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
