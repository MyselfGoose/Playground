"use client";

import { motion } from "framer-motion";

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function HangmanShell({ children }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] pb-[env(safe-area-inset-bottom)]">
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pastel-sky/40 via-background to-background"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      {children}
    </div>
  );
}
