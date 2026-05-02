"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar } from "../../../components/Avatar.jsx";
import { useUserProfile } from "../../../hooks/useLeaderboard.js";

function SurfaceCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-[var(--radius-2xl)] border border-muted-bright/50 bg-background/90 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-7 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1.5 text-sm font-semibold text-foreground/65">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TinyMetric({ label, value, accent = false }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] px-4 py-3 ring-1 transition-all ${
        accent
          ? "bg-gradient-to-br from-primary/20 to-accent-pink/15 ring-primary/30 shadow-[var(--shadow-play)]"
          : "bg-gradient-to-br from-muted-bright/45 to-background/70 ring-foreground/10"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-foreground/55">{label}</p>
      <p className={`mt-1.5 text-lg font-black ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function prettyDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = String(params?.userId ?? "");
  const { data, loading, error } = useUserProfile(userId);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-7xl items-center justify-center px-4">
        <div className="rounded-[var(--radius-2xl)] border border-muted-bright/50 bg-background/85 px-6 py-5 text-sm font-bold text-foreground/70 shadow-[var(--shadow-card)]">
          Loading player profile...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center px-4">
        <div className="w-full rounded-[var(--radius-2xl)] border border-error/25 bg-error/10 px-6 py-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm font-black uppercase tracking-wider text-error/80">Player profile unavailable</p>
          <p className="mt-2 text-sm font-semibold text-error">{error ?? "Profile not found"}</p>
          <Link href="/leaderboard" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-black text-foreground ring-1 ring-foreground/15">
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const user = data.user ?? {};
  const stats = data.stats ?? {};
  const typing = stats.typing ?? {};
  const npat = stats.npat ?? {};
  const hangman = stats.hangman ?? {};
  const global = stats.global ?? {};
  const breakdown = global.breakdown ?? {};
  const recentActivity = data.recentActivity ?? [];
  const totalGames = (typing.totalGames ?? 0) + (npat.totalGames ?? 0) + (hangman.totalGames ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-10 sm:gap-9 sm:py-12">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-primary/20 bg-gradient-to-br from-background/95 via-pastel-lavender/30 to-pastel-sky/25 p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-accent-purple/15 blur-3xl" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative z-[1] flex items-center gap-4 sm:gap-5">
            <Avatar username={user.username} src={user.avatarUrl} size="lg" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/55">Player profile</p>
              <h1 className="mt-1 text-4xl font-black tracking-tight text-foreground sm:text-5xl">{user.username}</h1>
              <p className="mt-1.5 text-base font-semibold text-foreground/65">Joined {prettyDate(user.createdAt)}</p>
            </div>
          </div>

          <div className="relative z-[1] grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <TinyMetric label="Global rank" value={global.rank != null ? `#${global.rank}` : "Unranked"} accent />
            <TinyMetric label="Global score" value={(global.score ?? 0).toFixed(1)} />
            <TinyMetric label="Games played" value={String(totalGames)} />
            <TinyMetric label="WPM rank" value={typing.wpmRank != null ? `#${typing.wpmRank}` : "Unranked"} />
            <TinyMetric label="Accuracy rank" value={typing.accuracyRank != null ? `#${typing.accuracyRank}` : "Unranked"} />
            <TinyMetric label="NPAT rank" value={npat.npatRank != null ? `#${npat.npatRank}` : "Unranked"} />
            <TinyMetric label="Hangman rank" value={hangman.hangmanRank != null ? `#${hangman.hangmanRank}` : "Unranked"} />
          </div>
        </div>

        <div className="relative z-[1] mt-6 grid gap-2.5 sm:grid-cols-4">
          {[
            { label: "Typing contribution", value: `${(breakdown.typing ?? 0).toFixed(0)}%` },
            { label: "Accuracy contribution", value: `${(breakdown.accuracy ?? 0).toFixed(0)}%` },
            { label: "NPAT contribution", value: `${(breakdown.npat ?? 0).toFixed(0)}%` },
            { label: "Activity contribution", value: `${(breakdown.activity ?? 0).toFixed(0)}%` },
            { label: "Hangman contribution", value: `${(breakdown.hangman ?? 0).toFixed(0)}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-lg)] bg-background/85 px-4 py-3 ring-1 ring-foreground/10">
              <p className="text-[11px] font-black uppercase tracking-wide text-foreground/55">{item.label}</p>
              <p className="mt-1.5 text-lg font-black text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SurfaceCard title="Typing Performance" subtitle="Speed, consistency, and race outcomes">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Best WPM" value={(typing.bestWpm ?? 0).toFixed(1)} accent />
            <TinyMetric label="Weighted accuracy" value={`${(typing.weightedAccuracy ?? 0).toFixed(1)}%`} />
            <TinyMetric label="Races played" value={String(typing.totalGames ?? 0)} />
            <TinyMetric label="Race wins" value={String(typing.multiWins ?? 0)} />
            <TinyMetric label="Total chars" value={String(typing.totalChars ?? 0)} />
            <TinyMetric label="WPM rank" value={typing.wpmRank != null ? `#${typing.wpmRank}` : "Unranked"} />
          </div>
        </SurfaceCard>

        <SurfaceCard title="NPAT Performance" subtitle="Average scoring and win efficiency">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Average score" value={(npat.averageScore ?? 0).toFixed(1)} accent />
            <TinyMetric label="Total score" value={(npat.totalScore ?? 0).toFixed(0)} />
            <TinyMetric label="Win rate" value={`${(npat.winRate ?? 0).toFixed(1)}%`} />
            <TinyMetric label="Wins" value={String(npat.wins ?? 0)} />
            <TinyMetric label="Games played" value={String(npat.totalGames ?? 0)} />
            <TinyMetric label="NPAT rank" value={npat.npatRank != null ? `#${npat.npatRank}` : "Unranked"} />
          </div>
        </SurfaceCard>

        <SurfaceCard title="Hangman Performance" subtitle="Win rate, accuracy, and efficiency">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Skill" value={(hangman.skill ?? 0).toFixed(1)} accent />
            <TinyMetric label="Win rate" value={`${(hangman.winRate ?? 0).toFixed(1)}%`} />
            <TinyMetric label="Accuracy" value={`${(hangman.accuracy ?? 0).toFixed(1)}%`} />
            <TinyMetric label="Wins" value={String(hangman.totalWins ?? 0)} />
            <TinyMetric label="Games played" value={String(Math.round(hangman.totalGames ?? 0))} />
            <TinyMetric label="Hangman rank" value={hangman.hangmanRank != null ? `#${hangman.hangmanRank}` : "Unranked"} />
          </div>
        </SurfaceCard>

        <SurfaceCard title="Global Standing" subtitle="Cross-game placement and consistency">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Global score" value={(global.score ?? 0).toFixed(2)} accent />
            <TinyMetric label="Global rank" value={global.rank != null ? `#${global.rank}` : "Unranked"} />
            <TinyMetric label="Consistency days" value={String(global.consistencyDays ?? 0)} />
            <TinyMetric label="Total games" value={String(totalGames)} />
            <TinyMetric label="Consistency contribution" value={`${(breakdown.consistency ?? 0).toFixed(0)}%`} />
            <TinyMetric label="Activity contribution" value={`${(breakdown.activity ?? 0).toFixed(0)}%`} />
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="How this rank is calculated"
        subtitle="Transparent explanation generated from weighted profile contributions"
      >
        <p className="text-base leading-relaxed text-foreground/75">
          {data.rankingExplanation ?? "No explanation available."}
        </p>
      </SurfaceCard>

      <SurfaceCard title="Recent Activity" subtitle="Latest completed games and outcomes">
        <div className="space-y-3.5">
          {recentActivity.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] bg-muted-bright/30 px-4 py-4 text-sm font-semibold text-foreground/60 ring-1 ring-foreground/10">
              No recent activity yet.
            </div>
          ) : (
            recentActivity.map((entry, idx) => (
              <div
                key={`${entry.type}-${entry.finishedAt}-${idx}`}
                className="rounded-[var(--radius-xl)] border border-muted-bright/50 bg-gradient-to-r from-background/90 via-muted-bright/20 to-transparent px-5 py-4 shadow-[var(--shadow-soft)]"
              >
                <p className="text-xs font-black uppercase tracking-wide text-foreground/55">
                  {entry.type === "typing" ? "Typing race" : "NPAT"} · {new Date(entry.finishedAt).toLocaleString()}
                </p>
                <p className="mt-2 text-base font-semibold text-foreground/80">
                  {entry.type === "typing"
                    ? `WPM ${(entry.summary?.wpm ?? 0).toFixed(1)}, accuracy ${(entry.summary?.accuracy ?? 0).toFixed(1)}%`
                    : `Score ${(entry.summary?.totalScore ?? 0).toFixed(0)}, outcome ${entry.summary?.outcome ?? "solo"}`}
                </p>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>

      <div className="pb-2 pt-1">
        <Link
          href="/leaderboard"
          className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-black text-foreground shadow-[var(--shadow-play)] ring-1 ring-foreground/15 transition-transform hover:scale-[1.02]"
        >
          Back to leaderboard
        </Link>
      </div>
    </div>
  );
}
