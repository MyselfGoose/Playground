"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LogOut } from "lucide-react";

/**
 * @param {{ onLeave: () => void }} props
 */
export function FibbagePlayHeader({ onLeave }) {
  const reduce = useReducedMotion();

  return (
    <div className="flex items-center px-4 pt-3">
      <motion.button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-[var(--fibbage-text-muted)] transition-colors hover:text-[var(--fibbage-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fibbage-accent)]"
        whileHover={reduce ? undefined : { x: -2 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
      >
        <LogOut className="h-5 w-5" aria-hidden />
        <span className="text-sm font-medium">Leave</span>
      </motion.button>
    </div>
  );
}
