"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-primary text-white shadow-[var(--shadow-play)] hover:shadow-xl hover:bg-primary-dark focus-visible:outline-primary",
  secondary:
    "bg-background text-foreground shadow-[var(--shadow-md)] ring-2 ring-muted-bright hover:bg-muted-bright focus-visible:outline-primary",
  tertiary:
    "bg-transparent text-foreground ring-2 ring-muted hover:ring-primary hover:text-primary transition-colors focus-visible:outline-primary",
  gradient:
    "bg-gradient-to-r from-accent-purple via-accent-pink to-accent-lemon text-foreground shadow-[var(--shadow-play)] hover:shadow-xl focus-visible:outline-accent-purple",
};

export const Button = forwardRef(function Button(
  { variant = "primary", className = "", type = "button", ...props },
  ref,
) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      whileHover={reduce ? undefined : { scale: 1.05, y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.95, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    />
  );
});

Button.displayName = "Button";
