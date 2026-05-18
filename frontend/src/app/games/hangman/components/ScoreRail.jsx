"use client";

/**
 * @param {{ rows: Array<{ uid: string, name: string, score: number }> }} props
 */
export function ScoreRail({ rows }) {
  return (
    <aside className="rounded-2xl border border-foreground/10 bg-muted-bright/20 p-4 lg:sticky lg:top-24 lg:self-start">
      <p className="text-xs font-black uppercase text-foreground/55">Scores</p>
      <ul className="mt-3 space-y-2 text-sm font-bold">
        {rows.map((row, i) => (
          <li key={row.uid} className="flex justify-between gap-2 rounded-xl bg-background/60 px-3 py-2">
            <span className="truncate">
              {i === 0 ? "👑 " : ""}
              {row.name}
            </span>
            <span className="text-primary">{row.score.toFixed(0)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
