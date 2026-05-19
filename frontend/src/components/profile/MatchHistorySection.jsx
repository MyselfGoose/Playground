"use client";

import { ProfileSection } from "./ProfileSection.jsx";
import { gameLabel, prettyDateTime } from "./profileUtils.js";

/**
 * @param {{
 *   loading: boolean;
 *   error: string | null;
 *   matches: Array<{
 *     game: string;
 *     placement?: number | null;
 *     finishedAt: string;
 *     roomCode?: string | null;
 *     summary?: Record<string, unknown>;
 *   }>;
 * }} props
 */
export function MatchHistorySection({ loading, error, matches }) {
  return (
    <ProfileSection title="Recent matches" subtitle="Your latest completed games">
      {loading ? (
        <p className="text-sm font-semibold text-foreground/60">Loading match history…</p>
      ) : error ? (
        <p className="text-sm font-semibold text-error">{error}</p>
      ) : matches.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] bg-muted-bright/30 px-4 py-4 text-sm font-semibold text-foreground/60 ring-1 ring-foreground/10">
          No matches recorded yet. Play a game to see history here.
        </div>
      ) : (
        <ul className="space-y-3">
          {matches.map((match, idx) => (
            <li
              key={`${match.game}-${match.finishedAt}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-xl)] border border-muted-bright/50 bg-gradient-to-r from-background/90 via-muted-bright/20 to-transparent px-4 py-3"
            >
              <div>
                <p className="text-sm font-black text-foreground">{gameLabel(match.game)}</p>
                <p className="text-xs font-semibold text-foreground/55">{prettyDateTime(match.finishedAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-foreground/75">
                {match.placement != null ? (
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-primary">
                    #{match.placement}
                  </span>
                ) : (
                  <span className="text-foreground/45">—</span>
                )}
                {match.roomCode ? (
                  <span className="font-mono text-xs tracking-wider text-foreground/55">{match.roomCode}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}
