"use client";

import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{ players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number }> }} props
 */
export function FibbageScoreRail({ players }) {
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <aside className="border-t border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)] px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
        Scores
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {sorted.map((player) => (
          <div
            key={player.userId}
            className="flex min-w-[5.5rem] flex-col items-center gap-1 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-2"
          >
            <Avatar
              username={player.username}
              avatarUrl={player.avatarUrl}
              avatarEmoji={player.avatarEmoji}
              size="sm"
            />
            <span className="max-w-[5rem] truncate text-xs font-semibold text-[var(--fibbage-text)]">
              {player.username}
            </span>
            <span className="text-sm font-black text-[var(--fibbage-gold)]">{player.score ?? 0}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
