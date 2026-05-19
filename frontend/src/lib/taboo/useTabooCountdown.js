"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown from a server timestamp, corrected via serverNow offset.
 *
 * @param {() => number} serverNow
 * @param {number | null | undefined} endsAtMs
 * @param {number} [fallbackSeconds]
 */
export function useTabooCountdown(serverNow, endsAtMs, fallbackSeconds = 0) {
  const [secondsRemaining, setSecondsRemaining] = useState(fallbackSeconds);

  useEffect(() => {
    if (typeof endsAtMs !== "number") {
      setSecondsRemaining(fallbackSeconds);
      return undefined;
    }
    const tick = () => {
      const ms = endsAtMs - serverNow();
      setSecondsRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [serverNow, endsAtMs, fallbackSeconds]);

  return secondsRemaining;
}
