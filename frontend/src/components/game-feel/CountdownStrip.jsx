"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { play } from "../../lib/sound/soundManager.js";
import { COUNTDOWN_STEPS, gameFeelMotion } from "./gameFeelMotion.js";

const DEFAULT_DURATION_MS = 3000;

/**
 * @param {{
 *   onComplete?: () => void,
 *   durationMs?: number,
 *   label?: string,
 *   className?: string,
 * }} props
 */
export function CountdownStrip({
  onComplete,
  durationMs = DEFAULT_DURATION_MS,
  label = "Get ready",
  className = "",
}) {
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const completedRef = useRef(false);
  const goSoundPlayedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const stepDuration = Math.max(200, Math.floor(durationMs / COUNTDOWN_STEPS.length));
  const currentLabel = COUNTDOWN_STEPS[stepIndex] ?? "GO";

  useEffect(() => {
    if (currentLabel === "GO" && !goSoundPlayedRef.current) {
      goSoundPlayedRef.current = true;
      play("success");
    }
  }, [currentLabel]);

  useEffect(() => {
    completedRef.current = false;
    goSoundPlayedRef.current = false;
    setStepIndex(0);

    if (reduceMotion) {
      const t = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          if (!goSoundPlayedRef.current) {
            goSoundPlayedRef.current = true;
            play("success");
          }
          onCompleteRef.current?.();
        }
      }, Math.min(durationMs, 400));
      return () => clearTimeout(t);
    }

    const timers = [];
    for (let i = 1; i < COUNTDOWN_STEPS.length; i += 1) {
      timers.push(
        setTimeout(() => {
          setStepIndex(i);
        }, stepDuration * i),
      );
    }
    timers.push(
      setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
      }, stepDuration * COUNTDOWN_STEPS.length),
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [durationMs, stepDuration, reduceMotion]);

  const stepMotion = reduceMotion
    ? gameFeelMotion.countdownStepReduced
    : gameFeelMotion.countdownStep;

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4 backdrop-blur-md ${className}`}
      {...gameFeelMotion.countdownBackdrop}
      role="dialog"
      aria-live="assertive"
      aria-label={`Countdown: ${currentLabel}`}
    >
      <div className="text-center">
        {label ? (
          <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground/50">{label}</p>
        ) : null}
        <AnimatePresence mode="wait">
          <motion.p
            key={reduceMotion ? "go" : currentLabel}
            className="mt-4 text-[min(28vw,8rem)] font-black tabular-nums leading-none text-primary drop-shadow-lg"
            {...stepMotion}
          >
            {reduceMotion ? "GO" : currentLabel}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
