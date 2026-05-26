"use client";

import { useTimerRemaining } from "../game-feel/useTimerRemaining.js";

/**
 * @param {{
 *   presenceStatus?: string,
 *   graceEndsAtMs?: number | null,
 *   graceSecondsRemaining?: number,
 *   className?: string,
 * }} props
 */
export function PlayerPresenceBadge({
  presenceStatus = "connected",
  graceEndsAtMs = null,
  graceSecondsRemaining = 0,
  className = "",
}) {
  const tick = useTimerRemaining({
    endsAt: presenceStatus === "disconnect_pending" ? graceEndsAtMs : null,
  });
  const seconds =
    presenceStatus === "disconnect_pending"
      ? Math.max(0, tick?.secondsRemaining ?? graceSecondsRemaining ?? 0)
      : 0;

  if (presenceStatus === "disconnect_pending") {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const label = `${m}:${String(s).padStart(2, "0")}`;
    return (
      <span
        className={`text-xs font-bold text-amber-700 dark:text-amber-300 ${className}`}
        role="status"
      >
        Reconnecting… {label}
      </span>
    );
  }

  if (presenceStatus === "gone") {
    return (
      <span className={`text-xs font-semibold text-foreground/45 ${className}`} role="status">
        Left
      </span>
    );
  }

  return null;
}
