"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-bold transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-accent text-white shadow-[var(--shadow-soft)] hover:shadow-lg focus-visible:outline-accent",
  secondary:
    "bg-white/80 text-ink shadow-[var(--shadow-card)] ring-2 ring-ink/5 hover:bg-white focus-visible:outline-accent-2",
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
      whileHover={reduce ? undefined : { scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      {...props}
    />
  );
});

Button.displayName = "Button";
