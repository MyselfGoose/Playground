"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { feedbackMotion } from "../../lib/feedback/feedbackMotion.js";
import { play } from "../../lib/sound/soundManager.js";
import { cn } from "../../lib/taboo/cn.js";

const styles = {
  correct: "bg-gradient-to-b from-emerald-500/[0.14] via-emerald-600/[0.06] to-transparent",
  taboo: "bg-gradient-to-b from-red-500/[0.16] via-red-600/[0.07] to-transparent",
  close: "bg-gradient-to-b from-amber-500/[0.12] via-amber-600/[0.05] to-transparent",
  skip: "bg-gradient-to-b from-yellow-400/[0.18] via-yellow-500/[0.08] to-transparent",
  review_reverted: "bg-gradient-to-b from-sky-500/[0.12] via-sky-600/[0.05] to-transparent",
  review_upheld: "bg-gradient-to-b from-neutral-500/[0.1] via-neutral-700/[0.04] to-transparent",
  field_complete: "bg-gradient-to-b from-emerald-400/[0.18] via-teal-500/[0.08] to-transparent",
};

const SUCCESS_VARIANTS = new Set(["correct", "field_complete"]);

export function GameFeedbackOverlay({ variant, reduceMotion }) {
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

  const show = Boolean(variant) && styles[variant];
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={variant}
          className={cn("pointer-events-none fixed inset-0 z-[45]", styles[variant])}
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
