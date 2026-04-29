"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "../../../components/Avatar.jsx";
import { useUserProfile } from "../../../hooks/useLeaderboard.js";

function StatCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = String(params?.userId ?? "");
  const { data, loading, error } = useUserProfile(userId);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-ink-muted">Loading profile...</div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-red-50 px-6 py-8 text-center text-sm font-bold text-red-800">
        {error ?? "Profile not found"}
      </div>
    );
  }

  const user = data.user ?? {};
  const stats = data.stats ?? {};
  const typing = stats.typing ?? {};
  const npat = stats.npat ?? {};
  const global = stats.global ?? {};
  const breakdown = global.breakdown ?? {};
  const recentActivity = data.recentActivity ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8">
      <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar username={user.username} src={user.avatarUrl} size="lg" />
          <div>
            <h1 className="text-2xl font-extrabold text-ink">{user.username}</h1>
            <p className="text-sm text-ink-muted">Global rank {global.rank != null ? `#${global.rank}` : "Unranked"}</p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-2">
            <Metric label="WPM Rank" value={typing.wpmRank != null ? `#${typing.wpmRank}` : "Unranked"} />
            <Metric label="Accuracy Rank" value={typing.accuracyRank != null ? `#${typing.accuracyRank}` : "Unranked"} />
            <Metric label="NPAT Rank" value={npat.npatRank != null ? `#${npat.npatRank}` : "Unranked"} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard title="Typing Stats">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Best WPM" value={(typing.bestWpm ?? 0).toFixed(1)} />
            <Metric label="Accuracy" value={`${(typing.weightedAccuracy ?? 0).toFixed(1)}%`} />
            <Metric label="Games" value={String(typing.totalGames ?? 0)} />
            <Metric label="Total Chars" value={String(typing.totalChars ?? 0)} />
          </div>
        </StatCard>
        <StatCard title="NPAT Stats">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Total Score" value={(npat.totalScore ?? 0).toFixed(0)} />
            <Metric label="Average Score" value={(npat.averageScore ?? 0).toFixed(1)} />
            <Metric label="Win Rate" value={`${(npat.winRate ?? 0).toFixed(1)}%`} />
            <Metric label="Games" value={String(npat.totalGames ?? 0)} />
          </div>
        </StatCard>
        <StatCard title="Global Stats">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Global Score" value={(global.score ?? 0).toFixed(2)} />
            <Metric label="Consistency Days" value={String(global.consistencyDays ?? 0)} />
            <Metric label="Typing Contribution" value={`${(breakdown.typing ?? 0).toFixed(0)}%`} />
            <Metric label="Activity Contribution" value={`${(breakdown.activity ?? 0).toFixed(0)}%`} />
          </div>
        </StatCard>
      </div>

      <StatCard title="Ranking Explanation">
        <p className="text-sm text-ink-muted">{data.rankingExplanation ?? "No explanation available."}</p>
      </StatCard>

      <StatCard title="Recent Activity">
        <div className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-ink-muted">No recent activity.</p>
          ) : (
            recentActivity.map((entry, idx) => (
              <div key={`${entry.type}-${entry.finishedAt}-${idx}`} className="rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  {entry.type === "typing" ? "Typing" : "NPAT"} · {new Date(entry.finishedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-ink">
                  {entry.type === "typing"
                    ? `WPM ${(entry.summary?.wpm ?? 0).toFixed(1)}, accuracy ${(entry.summary?.accuracy ?? 0).toFixed(1)}%`
                    : `Score ${(entry.summary?.totalScore ?? 0).toFixed(0)}, outcome ${entry.summary?.outcome ?? "solo"}`}
                </p>
              </div>
            ))
          )}
        </div>
      </StatCard>

      <div className="pb-2">
        <Link href="/leaderboard" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white">
          Back to leaderboard
        </Link>
      </div>
    </div>
  );
}
