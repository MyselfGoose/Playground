"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { play } from "../../lib/sound/soundManager.js";
import { gameFeelMotion } from "./gameFeelMotion.js";

const DEFAULT_DISPLAY_MS = 2000;

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   onDismiss: () => void,
 *   displayMs?: number,
 *   className?: string,
 * }} props
 */
export function WinnerBanner({
  title,
  subtitle,
  onDismiss,
  displayMs = DEFAULT_DISPLAY_MS,
  className = "",
}) {
  const reduceMotion = useReducedMotion();
  const dismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismissRef.current();
  };

  useEffect(() => {
    dismissedRef.current = false;
    play("success");
    const ms = reduceMotion ? Math.min(displayMs, 800) : displayMs;
    const t = setTimeout(() => dismiss(), ms);
    return () => clearTimeout(t);
  }, [title, subtitle, displayMs, reduceMotion]);

  const motionProps = reduceMotion
    ? gameFeelMotion.winnerBannerReduced
    : gameFeelMotion.winnerBanner;

  return (
    <motion.div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm ${className}`}
      initial={motionProps.initial}
      animate={motionProps.animate}
      exit={motionProps.exit}
      transition={motionProps.transition}
      role="dialog"
      aria-labelledby="winner-banner-title"
      aria-describedby={subtitle ? "winner-banner-subtitle" : undefined}
    >
      <div className="w-full max-w-md rounded-[var(--radius-2xl)] border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-accent-pink/10 p-8 text-center shadow-[var(--shadow-lg)] ring-2 ring-primary/20">
        <p
          id="winner-banner-title"
          className="text-3xl font-black tracking-tight text-foreground sm:text-4xl"
        >
          {title}
        </p>
        {subtitle ? (
          <p
            id="winner-banner-subtitle"
            className="mt-3 text-base font-semibold text-foreground/70"
          >
            {subtitle}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-8 rounded-full bg-primary px-6 py-2.5 text-sm font-extrabold text-white shadow-[var(--shadow-play)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => dismiss()}
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Shows WinnerBanner first, then children after dismiss or timeout.
 *
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   displayMs?: number,
 *   children: import('react').ReactNode,
 * }} props
 */
export function ResultGate({ title, subtitle, displayMs, children }) {
  const [showStats, setShowStats] = useState(false);

  return (
    <>
      <AnimatePresence>
        {!showStats ? (
          <WinnerBanner
            key="winner-banner"
            title={title}
            subtitle={subtitle}
            displayMs={displayMs}
            onDismiss={() => setShowStats(true)}
          />
        ) : null}
      </AnimatePresence>
      {showStats ? children : null}
    </>
  );
}
