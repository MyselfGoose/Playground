"use client";

import { memo } from "react";
import { PlayerPresenceBadge } from "../../../../components/party/PlayerPresenceBadge.jsx";

export function scoreRows(players) {
  return [...(players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * @param {{ players: object[], judgeUserId?: string | null }} props
 */
export const ScoreboardRail = memo(function ScoreboardRail({ players, judgeUserId = null }) {
  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-lg font-black text-foreground">Scoreboard</h3>
      <div className="mt-3 space-y-2">
        {scoreRows(players ?? []).map((p) => {
          const isJudge = judgeUserId && p.userId === judgeUserId;
          const pending = p.presenceStatus === "disconnect_pending";
          const gone = p.presenceStatus === "gone" || p.connected === false;
          return (
            <div
              key={p.userId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ${
                pending
                  ? "bg-amber-500/10 ring-amber-500/35 opacity-90"
                  : gone
                    ? "bg-muted-bright/15 ring-foreground/10 opacity-60"
                    : isJudge
                  ? "bg-primary/10 ring-primary/35"
                  : "bg-muted-bright/25 ring-foreground/10"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{p.username}</p>
                {isJudge ? (
                  <p className="text-xs font-black uppercase tracking-wide text-primary">Card Czar</p>
                ) : null}
                {pending || gone ? (
                  <PlayerPresenceBadge
                    presenceStatus={gone ? "gone" : p.presenceStatus}
                    graceEndsAtMs={p.graceEndsAtMs}
                    graceSecondsRemaining={p.graceSecondsRemaining}
                  />
                ) : null}
              </div>
              <p className="text-lg font-black text-primary">{p.score ?? 0}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
});

/** @deprecated Use named import `{ ScoreboardRail }` */
export default ScoreboardRail;
