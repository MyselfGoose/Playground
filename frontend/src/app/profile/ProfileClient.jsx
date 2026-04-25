"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";
import { useMyStats } from "../../hooks/useLeaderboard.js";

function StatTile({ label, value }) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-white/80 px-4 py-5 shadow-[var(--shadow-card)] ring-2 ring-white/80">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
    </div>
  );
}

export function ProfileClient() {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: stats, loading: statsLoading } = useMyStats();

  useEffect(() => {
    if (!loading && !user) {
      const search = searchParams.toString();
      const next = `${pathname}${search ? `?${search}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, pathname, searchParams]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Loading your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Redirecting to login…
      </div>
    );
  }

  const totalGames = stats
    ? (stats.typing?.totalGames ?? 0) + (stats.npat?.totalGames ?? 0)
    : 0;
  const globalScore = stats?.global?.score ?? 0;
  const globalRank = stats?.global?.rank;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-12 text-center sm:py-16">
      <Avatar username={user.username} src={user.avatarUrl} size="lg" />
      <h1 className="mt-6 text-3xl font-extrabold text-ink sm:text-4xl">{user.username}</h1>
      <p className="mt-2 text-ink-muted">{user.email}</p>

      <div className="mt-10 grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Games played" value={statsLoading ? "…" : String(totalGames)} />
        <StatTile label="Global score" value={statsLoading ? "…" : globalScore.toFixed(1)} />
        <StatTile label="Rank" value={statsLoading ? "…" : globalRank != null ? `#${globalRank}` : "Unranked"} />
      </div>

      {/* Breakdown */}
      {stats && !statsLoading && (
        <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Best WPM" value={(stats.typing?.bestWpm ?? 0).toFixed(1)} />
          <MiniStat label="Accuracy" value={`${(stats.typing?.weightedAccuracy ?? 0).toFixed(1)}%`} />
          <MiniStat label="NPAT avg" value={(stats.npat?.averageScore ?? 0).toFixed(1)} />
          <MiniStat label="NPAT wins" value={String(stats.npat?.wins ?? 0)} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/leaderboard"
          className="rounded-2xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
        >
          View Leaderboard
        </Link>
        <Link
          href="/games"
          className="text-sm font-bold text-accent underline-offset-4 hover:underline"
        >
          Back to games
        </Link>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-white/60 px-3 py-3 ring-1 ring-ink/5">
      <p className="text-lg font-extrabold text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
    </div>
  );
}
