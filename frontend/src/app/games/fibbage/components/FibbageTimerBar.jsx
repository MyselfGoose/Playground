"use client";

import { useReducedMotion } from "framer-motion";

/**
 * @param {{
 *   secondsRemaining: number,
 *   totalSeconds: number,
 *   className?: string,
 *   accelerating?: boolean,
 *   urgent?: boolean,
 * }} props
 */
export function FibbageTimerBar({
  secondsRemaining,
  totalSeconds,
  className = "",
  accelerating = false,
  urgent = false,
}) {
  const reduce = useReducedMotion();
  const pct = accelerating
    ? 100
    : totalSeconds > 0
      ? (secondsRemaining / totalSeconds) * 100
      : 0;
  const danger = !accelerating && secondsRemaining <= 5 && secondsRemaining > 0;
  const urgentStyle = urgent && secondsRemaining <= 10 && secondsRemaining > 0;

  return (
    <div className={`w-full max-w-xs space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs font-bold text-[var(--fibbage-text-muted)]">
        <span>{accelerating ? "Starting next phase…" : "Time left"}</span>
        <span
          className={
            accelerating
              ? "text-[var(--fibbage-accent)]"
              : danger || urgentStyle
                ? "text-[var(--fibbage-timer-danger)]"
                : ""
          }
          aria-live="polite"
        >
          {accelerating ? "…" : `${secondsRemaining}s`}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--fibbage-canvas-light)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={accelerating ? totalSeconds : secondsRemaining}
        aria-label="Phase timer"
      >
        <div
          className={`fibbage-timer-bar h-full ${
            accelerating
              ? "bg-[var(--fibbage-accent)]"
              : danger && !reduce
                ? "fibbage-timer-bar--danger timer-bar-fill-urgent"
                : urgentStyle && !reduce
                  ? "fibbage-timer-bar--danger"
                  : ""
          } ${accelerating && !reduce ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
