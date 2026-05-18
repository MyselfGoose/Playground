"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * @param {{ seconds: number }} props
 */
export function LobbyCountdownOverlay({ seconds }) {
  const reduceMotion = useReducedMotion();
  const display = Math.max(1, Math.min(5, seconds));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-live="assertive"
      aria-label={`Game starting in ${display} seconds`}
    >
      <motion.div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground/50">Starting soon</p>
        <motion.p
          key={display}
          className="mt-4 text-[min(28vw,8rem)] font-black tabular-nums leading-none text-primary drop-shadow-lg"
          initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          {display}
        </motion.p>
        <p className="mt-6 text-base font-semibold text-foreground/70">Get ready to play Hangman</p>
      </motion.div>
    </motion.div>
  );
}
