"use client";

import { useEffect, useState } from "react";
import { CountdownStrip } from "../game-feel/CountdownStrip.jsx";

/**
 * @param {{ raceStartAtMs: number; serverNow: () => number }} props
 */
export function MultiRaceCountdown({ raceStartAtMs, serverNow }) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, raceStartAtMs - serverNow()));

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(Math.max(0, raceStartAtMs - serverNow()));
    }, 100);
    return () => clearInterval(id);
  }, [raceStartAtMs, serverNow]);

  const secondsLeft = Math.ceil(msLeft / 1000);

  if (msLeft <= 3000 && msLeft > 0) {
    return (
      <CountdownStrip
        label="Race starting"
        durationMs={Math.min(3000, msLeft)}
        onComplete={() => {}}
      />
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center">
      <p className="font-sans text-sm uppercase tracking-[0.2em] text-[var(--tt-ink-muted)]">
        Starting in
      </p>
      <p className="mt-4 font-mono text-7xl font-bold tabular-nums text-[var(--tt-accent)]">
        {secondsLeft}
      </p>
    </div>
  );
}
