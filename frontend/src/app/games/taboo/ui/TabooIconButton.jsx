"use client";

import { motion } from "framer-motion";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   className?: string,
 *   "aria-label"?: string,
 *   onClick?: () => void,
 *   disabled?: boolean,
 * }} props
 */
export function TabooIconButton({ children, className, disabled, ...props }) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.92 }}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl taboo-surface-inset",
        "text-taboo-text-muted transition-colors duration-200 hover:text-taboo-text hover:bg-white/[0.06]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taboo-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
