"use client";

import { memo } from "react";

/**
 * @param {{
 *   players: Array<{ userId: string; displayName: string; color?: string; progress01?: number; wpm?: number; finishedAtMs?: number | null; rank?: number | null }>;
 *   selfId: string;
 * }} props
 */
function MultiRaceTrackInner({ players, selfId }) {
  return (
    <div className="multi-track">
      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--tt-ink-faint)]">
        Race progress
      </p>
      <div className="mt-2 space-y-1.5">
        {players.map((p) => {
          const pct = Math.min(100, Math.max(0, (p.progress01 ?? 0) * 100));
          const finished = p.finishedAtMs != null;
          const isSelf = p.userId === selfId;

          return (
            <div
              key={p.userId}
              className={`multi-track-lane ${isSelf ? "multi-track-lane--self" : ""} ${finished ? "multi-track-lane--finished" : ""}`}
            >
              <div
                className="multi-track-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: p.color ?? "var(--tt-accent-soft)",
                  opacity: isSelf ? 0.35 : 0.2,
                }}
              />
              <div className="multi-track-content">
                <div className="flex items-center gap-2">
                  <span
                    className="multi-player-dot"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate text-xs font-medium text-[var(--tt-ink)]">
                    {p.displayName}
                  </span>
                  {finished && p.rank != null && (
                    <span className="multi-badge multi-badge--ready text-[9px]">#{p.rank}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(p.wpm ?? 0) > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-[var(--tt-ink-muted)]">
                      {Math.round(p.wpm)}wpm
                    </span>
                  )}
                  <span className="font-mono text-[10px] tabular-nums text-[var(--tt-ink-faint)]">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MultiRaceTrack = memo(MultiRaceTrackInner);
