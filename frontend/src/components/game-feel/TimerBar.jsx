"use client";

import { useReducedMotion } from "framer-motion";
import { useTimerRemaining } from "./useTimerRemaining.js";

/**
 * @param {{
 *   endsAt?: number | null,
 *   serverOffsetMs?: number,
 *   warnAtSeconds?: number,
 *   totalSeconds?: number,
 *   className?: string,
 *   showNumeric?: boolean,
 *   fillClassName?: string,
 *   trackClassName?: string,
 * }} props
 */
export function TimerBar({
  endsAt = null,
  serverOffsetMs = 0,
  warnAtSeconds = 10,
  totalSeconds,
  className = "",
  showNumeric = true,
  fillClassName = "",
  trackClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const { secondsRemaining, percent, isUrgent, warnAnnounced } = useTimerRemaining({
    endsAt,
    serverOffsetMs,
    warnAtSeconds,
    totalSeconds,
  });

  const numericClass = isUrgent
    ? "text-error"
    : secondsRemaining <= warnAtSeconds * 2
      ? "text-warning"
      : "text-foreground";

  return (
    <div className={className}>
      {showNumeric ? (
        <div
          className={`font-mono text-2xl font-black tabular-nums ${numericClass} ${
            isUrgent && !reduceMotion ? "timer-bar-urgent-pulse" : ""
          }`}
        >
          {secondsRemaining}
        </div>
      ) : null}
      <div
        className={`relative mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10 ${trackClassName}`}
        aria-hidden
      >
        <div
          className={`absolute bottom-0 left-0 top-0 rounded-full bg-gradient-to-r transition-[width] ${
            isUrgent ? "from-error to-red-600" : "from-primary to-accent-purple"
          } ${isUrgent && !reduceMotion ? "timer-bar-fill-urgent" : ""} ${fillClassName}`}
          style={{
            width: `${percent}%`,
            transitionDuration: "var(--motion-normal)",
          }}
        />
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {warnAnnounced ? `${warnAtSeconds} seconds left` : ""}
      </span>
    </div>
  );
}
