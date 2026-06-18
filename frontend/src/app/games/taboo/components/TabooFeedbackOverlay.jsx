"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { feedbackMotion } from "../../../../lib/taboo/motion.js";
import { play } from "../../../../lib/sound/soundManager.js";
import { cn } from "../../../../lib/taboo/cn.js";

const styles = {
  correct: "bg-gradient-to-b from-taboo-success/15 via-taboo-success/5 to-transparent",
  taboo: "bg-gradient-to-b from-taboo-danger/15 via-taboo-danger/5 to-transparent",
  close: "bg-gradient-to-b from-taboo-warning/12 via-taboo-warning/5 to-transparent",
  skip: "bg-gradient-to-b from-taboo-warning/18 via-taboo-warning/8 to-transparent",
  review_reverted: "bg-gradient-to-b from-taboo-accent/12 via-taboo-accent/5 to-transparent",
  review_upheld: "bg-gradient-to-b from-taboo-text-faint/10 via-taboo-text-faint/4 to-transparent",
};

const SUCCESS_VARIANTS = new Set(["correct"]);

/**
 * @param {{ variant: string | null, reduceMotion?: boolean }} props
 */
export function TabooFeedbackOverlay({ variant, reduceMotion = false }) {
  const lastPlayedRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!variant || !SUCCESS_VARIANTS.has(variant)) return;
    if (lastPlayedRef.current === variant) return;
    lastPlayedRef.current = variant;
    play("success");
  }, [variant]);

  useEffect(() => {
    if (!variant) lastPlayedRef.current = null;
  }, [variant]);

  const show = Boolean(variant) && styles[/** @type {keyof typeof styles} */ (variant)];

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={variant}
          className={cn("pointer-events-none fixed inset-0 z-[45]", styles[/** @type {keyof typeof styles} */ (variant)])}
          initial={reduceMotion ? false : feedbackMotion.overlay.initial}
          animate={reduceMotion ? {} : feedbackMotion.overlay.animate}
          exit={reduceMotion ? {} : feedbackMotion.overlay.exit}
          transition={feedbackMotion.overlay.transition}
          aria-hidden
        />
      ) : null}
    </AnimatePresence>
  );
}
