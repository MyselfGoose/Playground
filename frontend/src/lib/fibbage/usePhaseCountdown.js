"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown from a server phaseEndsAt timestamp.
 *
 * @param {number | null | undefined} phaseEndsAtMs
 * @param {number} [fallbackSeconds]
 */
export function usePhaseCountdown(phaseEndsAtMs, fallbackSeconds = 0) {
  const [secondsRemaining, setSecondsRemaining] = useState(fallbackSeconds);

  useEffect(() => {
    if (typeof phaseEndsAtMs !== "number") {
      setSecondsRemaining(fallbackSeconds);
      return undefined;
    }
    const tick = () => {
      const ms = phaseEndsAtMs - Date.now();
      setSecondsRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phaseEndsAtMs, fallbackSeconds]);

  return secondsRemaining;
}

/**
 * @param {number | null | undefined} phaseEndsAtMs
 * @param {number} totalSeconds
 */
export function usePhaseProgress(phaseEndsAtMs, totalSeconds) {
  const secondsRemaining = usePhaseCountdown(phaseEndsAtMs, totalSeconds);
  if (!totalSeconds || typeof phaseEndsAtMs !== "number") return 0;
  return Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));
}
