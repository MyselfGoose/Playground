"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { play } from "../../../../lib/sound/soundManager.js";

/**
 * Flash overlay that fades out.
 * @param {{ message?: string | null, show?: boolean }} props
 */
export function FibbageFeedbackOverlay({ message = null, show = false }) {
  const visible = show || Boolean(message);
  const lastPlayedRef = useRef(/** @type {string | null} */ (null));

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
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.3 }}
        >
          <p className="rounded-2xl bg-[var(--fibbage-canvas)] bg-opacity-90 px-8 py-4 text-xl font-black uppercase tracking-wider text-[var(--fibbage-gold)]">
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
