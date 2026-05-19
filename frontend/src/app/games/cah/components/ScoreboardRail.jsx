"use client";

export function scoreRows(players) {
  return [...(players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * @param {{ players: object[], judgeUserId?: string | null }} props
 */
export default function ScoreboardRail({ players, judgeUserId = null }) {
  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-lg font-black text-foreground">Scoreboard</h3>
      <div className="mt-3 space-y-2">
        {scoreRows(players ?? []).map((p) => {
          const isJudge = judgeUserId && p.userId === judgeUserId;
          return (
            <div
              key={p.userId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ${
                isJudge
                  ? "bg-primary/10 ring-primary/35"
                  : "bg-muted-bright/25 ring-foreground/10"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{p.username}</p>
                {isJudge ? (
                  <p className="text-xs font-black uppercase tracking-wide text-primary">Card Czar</p>
                ) : null}
              </div>
              <p className="text-lg font-black text-primary">{p.score ?? 0}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
