"use client";

import { motion } from "framer-motion";

/**
 * @param {{ label: string; value: string; icon?: string; highlight?: boolean }} props
 */
export function ProfileStatHighlight({ label, value, icon, highlight = false }) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      className={`rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-md)] ring-2 transition-all ${
        highlight
          ? "bg-gradient-to-br from-primary/20 via-accent-pink/10 to-transparent ring-primary/40"
          : "bg-gradient-to-br from-muted-bright/30 to-transparent ring-muted-bright/40"
      }`}
    >
      {icon ? <span className={`mb-3 block text-4xl ${highlight ? "scale-125" : ""}`}>{icon}</span> : null}
      <p className={`mb-2 font-extrabold ${highlight ? "text-3xl text-primary" : "text-2xl text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{label}</p>
    </motion.div>
  );
}
