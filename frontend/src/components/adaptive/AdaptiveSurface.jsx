"use client";

/**
 * @param {{
 *   children: import('react').ReactNode;
 *   profile?: 'compact' | 'stacked' | 'split' | 'rail-right' | 'rail-bottom' | 'immersive';
 *   className?: string;
 * }} props
 */
export function AdaptiveSurface({ children, profile = "stacked", className = "" }) {
  const profileClass = {
    compact: "flex flex-col gap-[var(--space-4)]",
    stacked: "flex flex-col gap-[var(--space-6)]",
    split: "grid gap-[var(--space-6)] lg:grid-cols-2",
    "rail-right": "grid gap-[var(--space-6)] lg:grid-cols-[1fr_minmax(12rem,16rem)]",
    "rail-bottom": "flex flex-col gap-[var(--space-4)]",
    immersive: "flex min-h-play-area flex-col",
  }[profile];

  return (
    <div className={`adaptive-container adaptive-content-anchored w-full ${profileClass} ${className}`}>
      {children}
    </div>
  );
}
