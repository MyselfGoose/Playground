"use client";

import { motion } from "framer-motion";

export function LobbyPanel({ title, children, className = "" }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[var(--radius-2xl)] bg-gradient-to-br from-background to-muted-bright/30 p-6 sm:p-8 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40 backdrop-blur-sm ${className}`}
    >
      {title && (
        <h2 className="text-2xl font-extrabold text-foreground mb-6">
          {title}
        </h2>
      )}
      {children}
    </motion.section>
  );
}
