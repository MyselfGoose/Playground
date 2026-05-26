"use client";

import { PlayerPresenceBadge } from "../../../../components/party/PlayerPresenceBadge.jsx";

/**
 * @param {{ rows: Array<{ uid: string, name: string, score: number, presenceStatus?: string, graceEndsAtMs?: number | null, graceSecondsRemaining?: number, connected?: boolean }> }} props
 */
export function ScoreRail({ rows }) {
  return (
    <aside className="rounded-2xl border border-foreground/10 bg-muted-bright/20 p-4 lg:sticky lg:top-24 lg:self-start">
      <p className="text-xs font-black uppercase text-foreground/55">Scores</p>
      <ul className="mt-3 space-y-2 text-sm font-bold">
        {rows.map((row, i) => {
          const pending = row.presenceStatus === "disconnect_pending";
          const gone = row.presenceStatus === "gone" || row.connected === false;
          return (
          <li
            key={row.uid}
            className={`flex flex-col gap-1 rounded-xl px-3 py-2 ${
              pending ? "bg-amber-500/10" : gone ? "bg-background/40 opacity-60" : "bg-background/60"
            }`}
          >
            <div className="flex justify-between gap-2">
              <span className="truncate">
                {i === 0 ? "👑 " : ""}
                {row.name}
              </span>
              <span className="text-primary">{row.score.toFixed(0)}</span>
            </div>
            {pending || gone ? (
              <PlayerPresenceBadge
                presenceStatus={gone ? "gone" : row.presenceStatus}
                graceEndsAtMs={row.graceEndsAtMs}
                graceSecondsRemaining={row.graceSecondsRemaining}
              />
            ) : null}
          </li>
        );
        })}
      </ul>
    </aside>
  );
}
