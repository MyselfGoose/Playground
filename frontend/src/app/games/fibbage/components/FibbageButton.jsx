"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   variant?: 'primary' | 'secondary',
 *   className?: string,
 *   disabled?: boolean,
 *   pending?: boolean,
 *   type?: 'button' | 'submit',
 *   onClick?: () => void,
 * }} props
 */
export function FibbageButton({
  children,
  variant = "primary",
  className = "",
  disabled = false,
  pending = false,
  type = "button",
  onClick,
}) {
  const reduce = useReducedMotion();
  const isDisabled = disabled || pending;
  const variantClass =
    variant === "secondary" ? "fibbage-btn fibbage-btn--secondary" : "fibbage-btn";

  return (
    <motion.button
      type={type}
      className={`${variantClass} inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fibbage-accent)] ${className}`}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={reduce || isDisabled ? undefined : { scale: 1.02 }}
      whileTap={reduce || isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  );
}
