"use client";

import { cn } from "../../../../lib/taboo/cn.js";

const levelClasses = {
  1: "taboo-surface-card",
  2: "taboo-surface-raised",
  inset: "taboo-surface-inset",
  card: "taboo-surface-card",
  raised: "taboo-surface-raised",
};

const glowClasses = {
  a: "taboo-glow-a",
  b: "taboo-glow-b",
  accent: "taboo-glow-accent",
  none: "",
};

/**
 * @param {{
 *   level?: keyof typeof levelClasses,
 *   glow?: keyof typeof glowClasses,
 *   className?: string,
 *   children: import("react").ReactNode,
 *   animate?: boolean,
 * }} props
 */
export function TabooCard({
  level = 2,
  glow = "none",
  className,
  children,
  animate = false,
}) {
  const classes = cn(
    "overflow-hidden",
    levelClasses[level] || levelClasses[2],
    glowClasses[glow],
    className,
  );

  return <div className={classes}>{children}</div>;
}
