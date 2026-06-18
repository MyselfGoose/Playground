"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   href: string,
 *   children: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function TabooLinkPill({ href, children, className }) {
  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center rounded-full border border-taboo-border bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium",
          "text-taboo-text-muted transition-all duration-200 hover:border-taboo-team-a/30 hover:bg-white/[0.08] hover:text-taboo-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taboo-ring",
          className,
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
}

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   variant?: "default" | "success" | "warning" | "danger",
 *   className?: string,
 * }} props
 */
export function TabooChip({ children, variant = "default", className }) {
  const variantClasses = {
    default: "taboo-surface-inset text-taboo-text-muted",
    success: "bg-taboo-success-soft text-taboo-success",
    warning: "bg-taboo-warning-soft text-taboo-warning",
    danger: "bg-taboo-danger-soft text-taboo-danger-text",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
