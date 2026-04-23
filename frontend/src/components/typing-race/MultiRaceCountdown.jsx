"use client";

import { useEffect, useState } from "react";

/**
 * @param {{ raceStartAtMs: number; serverNow: () => number }} props
 */
export function MultiRaceCountdown({ raceStartAtMs, serverNow }) {
  const [left, setLeft] = useState(5);

  useEffect(() => {
    const id = setInterval(() => {
      const ms = raceStartAtMs - serverNow();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    }, 100);
    return () => clearInterval(id);
  }, [raceStartAtMs, serverNow]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <p className="font-sans text-sm uppercase tracking-[0.2em] text-[var(--tt-ink-muted)]">
        Starting in
      </p>
      <p className="mt-4 font-mono text-7xl font-bold tabular-nums text-[var(--tt-accent)]">
        {left}
      </p>
    </div>
  );
}
