"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";

const variantClasses = {
  primary: "taboo-btn-primary text-white",
  secondary: "taboo-btn-secondary text-white",
  ghost:
    "bg-white/[0.06] text-taboo-text hover:bg-white/[0.1]",
  success:
    "bg-taboo-success-soft text-taboo-success hover:bg-taboo-success/25",
  danger:
    "bg-taboo-danger-soft text-taboo-danger-text hover:bg-taboo-danger/25",
  warning:
    "bg-taboo-warning-soft text-taboo-warning hover:bg-taboo-warning/25",
  teamA:
    "bg-taboo-team-a-soft text-taboo-team-a-text hover:bg-taboo-team-a/30 shadow-[var(--taboo-team-a-glow)]",
  teamB:
    "bg-taboo-team-b-soft text-taboo-team-b-text hover:bg-taboo-team-b/30 shadow-[var(--taboo-team-b-glow)]",
  outlineSuccess: "taboo-action-outline-success",
  outlineWarning: "taboo-action-outline-warning",
  outlineDanger: "taboo-action-outline-danger",
  voteFair: "taboo-vote-fair",
  voteNotFair: "taboo-vote-not-fair",
};

const sizeClasses = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-sm sm:h-[3.25rem] sm:text-base",
};

/**
 * @param {{
 *   className?: string,
 *   variant?: keyof typeof variantClasses,
 *   size?: keyof typeof sizeClasses,
 *   type?: "button" | "submit" | "reset",
 *   loading?: boolean,
 *   children: import("react").ReactNode,
 *   disabled?: boolean,
 *   onClick?: () => void,
 * }} props
 */
export function TabooButton({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  loading = false,
  children,
  disabled,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taboo-ring focus-visible:ring-offset-2 focus-visible:ring-offset-taboo-canvas",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        sizeClasses[size] || sizeClasses.md,
        variantClasses[variant] || variantClasses.primary,
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  );
}
