"use client";

import { useReducedMotion } from "framer-motion";

/**
 * @param {{ secondsRemaining: number, totalSeconds: number, className?: string }} props
 */
export function FibbageTimerBar({ secondsRemaining, totalSeconds, className = "" }) {
  const reduce = useReducedMotion();
  const pct = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;
  const danger = secondsRemaining <= 5 && secondsRemaining > 0;

  return (
    <div className={`w-full max-w-xs space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs font-bold text-[var(--fibbage-text-muted)]">
        <span>Time left</span>
        <span
          className={danger ? "text-[var(--fibbage-timer-danger)]" : ""}
          aria-live="polite"
        >
          {secondsRemaining}s
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--fibbage-canvas-light)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={secondsRemaining}
        aria-label="Phase timer"
      >
        <div
          className={`fibbage-timer-bar h-full ${danger && !reduce ? "fibbage-timer-bar--danger timer-bar-fill-urgent" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
