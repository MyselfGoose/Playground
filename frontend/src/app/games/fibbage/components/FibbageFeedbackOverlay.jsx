"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { play } from "../../../../lib/sound/soundManager.js";
import { feedbackFlash } from "../../../../lib/fibbage/motion.js";

/**
 * Flash overlay that fades out.
 * @param {{ message?: string | null, show?: boolean }} props
 */
export function FibbageFeedbackOverlay({ message = null, show = false }) {
  const reduce = useReducedMotion();
  const visible = show || Boolean(message);
  const lastPlayedRef = useRef(/** @type {string | null} */ (null));
  const motionProps = feedbackFlash(reduce);

  useEffect(() => {
    if (!visible || !message) return;
    if (lastPlayedRef.current === message) return;
    lastPlayedRef.current = message;
    play("success");
  }, [visible, message]);

  useEffect(() => {
    if (!visible) lastPlayedRef.current = null;
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && message ? (
        <motion.div
          key={message}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          {...motionProps}
        >
          <p className="rounded-2xl border border-[var(--fibbage-gold)]/30 bg-[var(--fibbage-canvas)]/95 px-8 py-4 text-xl font-black uppercase tracking-wider text-[var(--fibbage-gold)] shadow-[var(--fibbage-card-shadow-selected)]">
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
