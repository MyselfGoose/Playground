"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-[filter,background-color,box-shadow] duration-[var(--motion-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-primary-dark text-white shadow-[var(--shadow-play)] hover:brightness-95 focus-visible:outline-primary",
  secondary:
    "bg-background text-foreground shadow-[var(--shadow-md)] ring-2 ring-muted-bright hover:bg-muted-bright hover:brightness-95 focus-visible:outline-primary",
  tertiary:
    "bg-transparent text-foreground ring-2 ring-muted hover:ring-primary hover:text-primary hover:brightness-95 focus-visible:outline-primary",
  ghost:
    "bg-transparent text-muted hover:bg-muted-bright/50 hover:text-foreground focus-visible:outline-primary",
  gradient:
    "bg-gradient-to-r from-accent-purple via-accent-pink to-accent-lemon text-foreground shadow-[var(--shadow-md)] hover:brightness-95 focus-visible:outline-accent-purple",
};

export const Button = forwardRef(function Button(
  { variant = "primary", className = "", type = "button", ...props },
  ref,
) {
  const reduce = useReducedMotion();
  /** Secondary/tertiary use CSS hover only — avoids scale churn in dense game UIs. */
  const useMotionHover = variant === "primary" || variant === "gradient";

  return (
    <motion.button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      whileHover={reduce || !useMotionHover ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    />
  );
});

Button.displayName = "Button";
