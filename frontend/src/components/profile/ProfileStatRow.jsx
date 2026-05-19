"use client";

import { motion } from "framer-motion";

/**
 * @param {{ label: string; value: string; icon?: string }} props
 */
export function ProfileStatRow({ label, value, icon }) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center justify-between rounded-[var(--radius-lg)] bg-muted-bright/20 px-4 py-3 ring-1 ring-muted-bright/30"
    >
      <div className="flex items-center gap-3">
        {icon ? <span className="text-2xl">{icon}</span> : null}
        <span className="text-sm font-bold text-foreground/70">{label}</span>
      </div>
      <span className="text-lg font-extrabold text-primary">{value}</span>
    </motion.div>
  );
}
