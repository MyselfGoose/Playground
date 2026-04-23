"use client";

import { memo } from "react";

/**
 * @param {{
 *   players: Array<{ userId: string; displayName: string; color?: string; progress01?: number }>;
 *   selfId: string;
 * }} props
 */
function MultiRaceTrackInner({ players, selfId }) {
  return (
    <div className="mb-6 space-y-2 rounded-[var(--tt-radius-lg)] border border-[var(--tt-ink-muted)]/15 bg-[var(--tt-bg-elevated)]/80 p-3">
      <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-[var(--tt-ink-muted)]">
        Race
      </p>
      {players.map((p) => (
        <div key={p.userId} className="relative h-8 w-full overflow-hidden rounded-md bg-[var(--tt-bg)]/80">
          <div
            className="absolute inset-y-0 left-0 rounded-md transition-transform duration-100 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, (p.progress01 ?? 0) * 100))}%`,
              backgroundColor: p.color ?? "var(--tt-accent-soft)",
              opacity: p.userId === selfId ? 1 : 0.55,
            }}
          />
          <div className="relative z-[1] flex h-full items-center justify-between px-2 text-xs font-medium text-[var(--tt-ink-strong)] mix-blend-difference">
            <span className="truncate">{p.displayName}</span>
            <span className="font-mono tabular-nums">
              {Math.round((p.progress01 ?? 0) * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const MultiRaceTrack = memo(MultiRaceTrackInner);
