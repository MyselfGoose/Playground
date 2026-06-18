"use client";

import { motion } from "framer-motion";

/**
 * Unified stat tile for profile pages.
 * @param {{ label: string; value: string; icon?: string; accent?: boolean; highlight?: boolean; className?: string }} props
 */
export function ProfileStatCard({ label, value, icon, accent = false, highlight = false, className = "" }) {
  if (highlight) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        className={`rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-md)] ring-2 transition-all ${
          accent
            ? "bg-gradient-to-br from-primary/20 via-accent-pink/10 to-transparent ring-primary/40"
            : "bg-gradient-to-br from-muted-bright/30 to-transparent ring-muted-bright/40"
        } ${className}`}
      >
        {icon ? <span className="mb-3 block text-3xl">{icon}</span> : null}
        <p className={`mb-2 font-extrabold ${accent ? "text-3xl text-primary" : "text-2xl text-foreground"}`}>
          {value}
        </p>
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{label}</p>
      </motion.div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-lg)] px-4 py-3 ring-1 transition-all ${
        accent
          ? "bg-gradient-to-br from-primary/20 to-accent-pink/15 ring-primary/30 shadow-[var(--shadow-play)]"
          : "bg-gradient-to-br from-muted-bright/45 to-background/70 ring-foreground/10"
      } ${className}`}
    >
      {icon ? <span className="mb-1 block text-lg" aria-hidden>{icon}</span> : null}
      <p className="text-[11px] font-black uppercase tracking-wide text-foreground/55">{label}</p>
      <p className={`mt-1.5 text-lg font-black ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
