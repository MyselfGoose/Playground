"use client";

import { motion } from "framer-motion";

const toneStyles = {
  neutral: "bg-muted-bright/40 text-foreground ring-1 ring-muted-bright/50",
  primary: "bg-primary/20 text-primary ring-1 ring-primary/40",
  success: "bg-success/20 text-success ring-1 ring-success/40",
  warning: "bg-warning/20 text-warning ring-1 ring-warning/40",
  error: "bg-error/20 text-error ring-1 ring-error/40",
};

/** @param {{ children: import('react').ReactNode; variant?: string; tone?: string; className?: string; animated?: boolean }} props */
export function Badge({
  children,
  variant,
  tone,
  className = "",
  animated = false,
}) {
  const resolvedTone = tone ?? (variant === "default" ? "neutral" : variant) ?? "neutral";
  const style = toneStyles[resolvedTone] ?? toneStyles.neutral;

  const content = (
    <span
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${style} ${className}`}
    >
      {children}
    </span>
  );

  if (animated) {
    return (
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        {content}
      </motion.div>
    );
  }

  return content;
}
