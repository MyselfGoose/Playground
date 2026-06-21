"use client";

/**
 * @param {{ secondsRemaining: number, totalSeconds: number }} props
 */
export function FibbageTimerBar({ secondsRemaining, totalSeconds }) {
  const pct = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;
  const danger = secondsRemaining <= 5 && secondsRemaining > 0;

  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--fibbage-text-muted)]">
        <span>Time left</span>
        <span className={danger ? "text-[var(--fibbage-timer-danger)]" : ""}>{secondsRemaining}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--fibbage-canvas-light)]">
        <div
          className={`fibbage-timer-bar h-full ${danger ? "fibbage-timer-bar--danger" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
