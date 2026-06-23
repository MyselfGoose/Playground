"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { play } from "../../../../lib/sound/soundManager.js";
import { feedbackFlash } from "../../../../lib/fibbage/motion.js";

/** @typedef {'success' | 'vote' | 'fool' | 'truth' | 'win' | 'default'} FibbageCelebrationType */

const SOUND_BY_TYPE = {
  success: "success",
  vote: "vote",
  fool: "fool",
  truth: "truth",
  win: "win",
  default: "success",
};

/**
 * Contextual celebration overlay with typed styling and sounds.
 * @param {{ message?: string | null, type?: FibbageCelebrationType, show?: boolean }} props
 */
export function FibbageFeedbackOverlay({
  message = null,
  type = "default",
  show = false,
}) {
  const reduce = useReducedMotion();
  const visible = show || Boolean(message);
  const lastPlayedRef = useRef(/** @type {string | null} */ (null));
  const motionProps = feedbackFlash(reduce);
  const celebrationType = type === "default" ? "success" : type;
  const soundId = SOUND_BY_TYPE[celebrationType] ?? "success";

  useEffect(() => {
    if (!visible || !message) return;
    const key = `${message}:${celebrationType}`;
    if (lastPlayedRef.current === key) return;
    lastPlayedRef.current = key;
    play(soundId);
  }, [visible, message, celebrationType, soundId]);

  useEffect(() => {
    if (!visible) lastPlayedRef.current = null;
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && message ? (
        <motion.div
          key={`${message}-${celebrationType}`}
          className={`fibbage-celebration fibbage-celebration--${celebrationType}`}
          aria-hidden="true"
          {...motionProps}
        >
          <p className="fibbage-celebration__card">{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
