"use client";

export function scoreRows(players) {
  return [...(players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export default function ScoreboardRail({ players }) {
  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-lg font-black text-foreground">Scoreboard</h3>
      <div className="mt-3 space-y-2">
        {scoreRows(players ?? []).map((p) => (
          <div key={p.userId} className="flex items-center justify-between rounded-lg bg-muted-bright/25 px-3 py-2 ring-1 ring-foreground/10">
            <p className="text-sm font-bold text-foreground">{p.username}</p>
            <p className="text-lg font-black text-primary">{p.score ?? 0}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
