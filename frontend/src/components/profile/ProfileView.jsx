"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "../../lib/context/UserContext.jsx";
import { useMyStats, useUserProfile } from "../../hooks/useLeaderboard.js";
import { useMatchHistory } from "../../hooks/useMatchHistory.js";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";
import { ProfileHero } from "./ProfileHero.jsx";
import { ProfileMetric } from "./ProfileMetric.jsx";
import { ProfileSection } from "./ProfileSection.jsx";
import { ProfileStatHighlight } from "./ProfileStatHighlight.jsx";
import { ProfileStatRow } from "./ProfileStatRow.jsx";
import { MatchHistorySection } from "./MatchHistorySection.jsx";
import { prettyDateTime } from "./profileUtils.js";

/**
 * @param {{ mode: 'self' | 'public'; userId?: string }} props
 */
export function ProfileView({ mode, userId: userIdProp }) {
  if (mode === "self") {
    return <SelfProfile />;
  }
  return <PublicProfile userId={userIdProp ?? ""} />;
}

function SelfProfile() {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { data: stats, loading: statsLoading, error: statsError } = useMyStats();
  const userId = user?.id != null ? String(user.id) : null;
  const matchHistory = useMatchHistory(userId, { limit: 10 });

  useEffect(() => {
    if (!loading && !user) {
      const next = `${pathname}${search ? `?${search}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, pathname, search]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-foreground/60">
        Loading your profile…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-foreground/60">
        Redirecting to login…
      </div>
    );
  }

  const totalGames = stats
    ? (stats.typing?.totalGames ?? 0) +
      (stats.npat?.totalGames ?? 0) +
      (stats.taboo?.gamesPlayed ?? 0) +
      (stats.cah?.gamesPlayed ?? 0) +
      (stats.hangman?.totalGames ?? 0)
    : 0;
  const globalScore = stats?.global?.score ?? 0;
  const globalRank = stats?.global?.rank;

  return (
    <motion.div initial={false} className="w-full">
      <ProfileHero
        variant="self"
        username={user.username}
        avatarUrl={user.avatarUrl}
        email={user.email}
      />

      {statsError ? (
        <section className="px-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-[var(--radius-xl)] border border-error/20 bg-error/5 px-4 py-3 text-center text-sm font-bold text-error">
            Could not load your stats. {statsError}
          </div>
        </section>
      ) : null}

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          {statsLoading && !stats ? (
            <LoadingSkeleton count={3} variant="card" />
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-3"
            >
              <ProfileStatHighlight
                icon="🏆"
                label="Global Rank"
                value={globalRank != null ? `#${globalRank}` : "Unranked"}
                highlight
              />
              <ProfileStatHighlight icon="⭐" label="Overall Score" value={globalScore.toFixed(0)} />
              <ProfileStatHighlight icon="🎮" label="Games Played" value={String(totalGames)} />
            </motion.div>
          )}
        </div>
      </section>

      {stats ? (
        <section className="bg-muted-bright/10 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <div>
              <h2 className="mb-8 text-2xl font-extrabold text-foreground">Performance Breakdown</h2>

              <div className="mb-10">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                  <span>⌨️</span> Typing Race
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfileStatRow icon="🚀" label="Best Speed (WPM)" value={(stats.typing?.bestWpm ?? 0).toFixed(1)} />
                  <ProfileStatRow icon="🎯" label="Average Accuracy" value={`${(stats.typing?.weightedAccuracy ?? 0).toFixed(1)}%`} />
                  <ProfileStatRow icon="🏁" label="Races Completed" value={String(stats.typing?.totalGames ?? 0)} />
                  <ProfileStatRow
                    icon="👑"
                    label="Typing Rank"
                    value={stats.typing?.wpmRank ? `#${stats.typing.wpmRank}` : "Unranked"}
                  />
                </div>
              </div>

              <div className="mb-10">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                  <span>🌍</span> Name Place Animal Thing
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfileStatRow icon="⭐" label="Average Score" value={(stats.npat?.averageScore ?? 0).toFixed(1)} />
                  <ProfileStatRow icon="🥇" label="Total Wins" value={String(stats.npat?.wins ?? 0)} />
                  <ProfileStatRow icon="🎮" label="Games Played" value={String(stats.npat?.totalGames ?? 0)} />
                  <ProfileStatRow
                    icon="📊"
                    label="NPAT Rank"
                    value={stats.npat?.npatRank ? `#${stats.npat.npatRank}` : "Unranked"}
                  />
                </div>
              </div>

              <div className="mb-10">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                  <span>🃏</span> Cards Against Humanity
                </h3>
                <p className="mb-4 max-w-xl text-xs text-foreground/55">
                  Rankings use composite score from round win rate, average wins per finished game, and games played.
                  At least four finished matches are required to appear on the CAH leaderboard.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfileStatRow icon="🎯" label="Composite score" value={(stats.cah?.score ?? 0).toFixed(1)} />
                  <ProfileStatRow icon="🏆" label="Round wins" value={String(stats.cah?.roundWins ?? 0)} />
                  <ProfileStatRow icon="📈" label="Win rate (submitter rounds)" value={`${(stats.cah?.winRate ?? 0).toFixed(1)}%`} />
                  <ProfileStatRow icon="🎮" label="Games finished" value={String(stats.cah?.gamesPlayed ?? 0)} />
                  <ProfileStatRow icon="🔄" label="Rounds played (submit)" value={String(stats.cah?.roundsPlayed ?? 0)} />
                  <ProfileStatRow icon="⚖️" label="Rounds judged" value={String(stats.cah?.roundsJudged ?? 0)} />
                  <ProfileStatRow
                    icon="📊"
                    label="CAH rank"
                    value={stats.cah?.cahRank ? `#${stats.cah.cahRank}` : "Unranked"}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                  <span>🎯</span> Hangman
                </h3>
                <p className="mb-4 max-w-xl text-xs text-foreground/55">
                  Ranking is based on win rate, guessing accuracy, efficiency, and recent consistency.
                  Minimum five completed games are required to appear on the Hangman leaderboard.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfileStatRow icon="🧠" label="Hangman skill" value={(stats.hangman?.skill ?? 0).toFixed(1)} />
                  <ProfileStatRow icon="🏆" label="Wins" value={String(stats.hangman?.totalWins ?? 0)} />
                  <ProfileStatRow icon="📈" label="Win rate" value={`${(stats.hangman?.winRate ?? 0).toFixed(1)}%`} />
                  <ProfileStatRow icon="🎯" label="Guess accuracy" value={`${(stats.hangman?.accuracy ?? 0).toFixed(1)}%`} />
                  <ProfileStatRow icon="🎮" label="Games played" value={String(Math.round(stats.hangman?.totalGames ?? 0))} />
                  <ProfileStatRow
                    icon="📊"
                    label="Hangman rank"
                    value={stats.hangman?.hangmanRank ? `#${stats.hangman.hangmanRank}` : "Unranked"}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <MatchHistorySection
            loading={matchHistory.loading}
            error={matchHistory.error}
            matches={matchHistory.matches}
          />
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={false}
            className="flex flex-col justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/leaderboard"
              className="rounded-full bg-primary px-8 py-4 text-center font-extrabold text-white shadow-[var(--shadow-play)] transition-all hover:scale-105 active:scale-95"
            >
              View Global Leaderboard
            </Link>
            <Link
              href="/games"
              className="rounded-full bg-muted-bright/50 px-8 py-4 text-center font-extrabold text-foreground transition-all hover:bg-muted-bright/70"
            >
              Play More Games
            </Link>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}

/**
 * @param {{ userId: string }} props
 */
function PublicProfile({ userId }) {
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
          <Link
            href="/leaderboard"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-black text-foreground ring-1 ring-foreground/15"
          >
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

  const heroMetrics = (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <ProfileMetric label="Global rank" value={global.rank != null ? `#${global.rank}` : "Unranked"} accent />
      <ProfileMetric label="Global score" value={(global.score ?? 0).toFixed(1)} />
      <ProfileMetric label="Games played" value={String(totalGames)} />
      <ProfileMetric label="WPM rank" value={typing.wpmRank != null ? `#${typing.wpmRank}` : "Unranked"} />
      <ProfileMetric label="Accuracy rank" value={typing.accuracyRank != null ? `#${typing.accuracyRank}` : "Unranked"} />
      <ProfileMetric label="NPAT rank" value={npat.npatRank != null ? `#${npat.npatRank}` : "Unranked"} />
      <ProfileMetric label="Hangman rank" value={hangman.hangmanRank != null ? `#${hangman.hangmanRank}` : "Unranked"} />
    </div>
  );

  const heroBreakdown = (
    <div className="grid gap-2.5 sm:grid-cols-4">
      {[
        { label: "Typing contribution", value: `${(breakdown.typing ?? 0).toFixed(0)}%` },
        { label: "Accuracy contribution", value: `${(breakdown.accuracy ?? 0).toFixed(0)}%` },
        { label: "NPAT contribution", value: `${(breakdown.npat ?? 0).toFixed(0)}%` },
        { label: "Activity contribution", value: `${(breakdown.activity ?? 0).toFixed(0)}%` },
        { label: "Hangman contribution", value: `${(breakdown.hangman ?? 0).toFixed(0)}%` },
      ].map((item) => (
        <ProfileMetric key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-10 sm:gap-9 sm:py-12">
      <ProfileHero
        variant="public"
        username={user.username}
        avatarUrl={user.avatarUrl}
        createdAt={user.createdAt}
        metrics={heroMetrics}
        breakdown={heroBreakdown}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ProfileSection title="Typing Performance" subtitle="Speed, consistency, and race outcomes">
          <div className="grid grid-cols-2 gap-3">
            <ProfileMetric label="Best WPM" value={(typing.bestWpm ?? 0).toFixed(1)} accent />
            <ProfileMetric label="Weighted accuracy" value={`${(typing.weightedAccuracy ?? 0).toFixed(1)}%`} />
            <ProfileMetric label="Races played" value={String(typing.totalGames ?? 0)} />
            <ProfileMetric label="Race wins" value={String(typing.multiWins ?? 0)} />
            <ProfileMetric label="Total chars" value={String(typing.totalChars ?? 0)} />
            <ProfileMetric label="WPM rank" value={typing.wpmRank != null ? `#${typing.wpmRank}` : "Unranked"} />
          </div>
        </ProfileSection>

        <ProfileSection title="NPAT Performance" subtitle="Average scoring and win efficiency">
          <div className="grid grid-cols-2 gap-3">
            <ProfileMetric label="Average score" value={(npat.averageScore ?? 0).toFixed(1)} accent />
            <ProfileMetric label="Total score" value={(npat.totalScore ?? 0).toFixed(0)} />
            <ProfileMetric label="Win rate" value={`${(npat.winRate ?? 0).toFixed(1)}%`} />
            <ProfileMetric label="Wins" value={String(npat.wins ?? 0)} />
            <ProfileMetric label="Games played" value={String(npat.totalGames ?? 0)} />
            <ProfileMetric label="NPAT rank" value={npat.npatRank != null ? `#${npat.npatRank}` : "Unranked"} />
          </div>
        </ProfileSection>

        <ProfileSection title="Hangman Performance" subtitle="Win rate, accuracy, and efficiency">
          <div className="grid grid-cols-2 gap-3">
            <ProfileMetric label="Skill" value={(hangman.skill ?? 0).toFixed(1)} accent />
            <ProfileMetric label="Win rate" value={`${(hangman.winRate ?? 0).toFixed(1)}%`} />
            <ProfileMetric label="Accuracy" value={`${(hangman.accuracy ?? 0).toFixed(1)}%`} />
            <ProfileMetric label="Wins" value={String(hangman.totalWins ?? 0)} />
            <ProfileMetric label="Games played" value={String(Math.round(hangman.totalGames ?? 0))} />
            <ProfileMetric label="Hangman rank" value={hangman.hangmanRank != null ? `#${hangman.hangmanRank}` : "Unranked"} />
          </div>
        </ProfileSection>

        <ProfileSection title="Global Standing" subtitle="Cross-game placement and consistency">
          <div className="grid grid-cols-2 gap-3">
            <ProfileMetric label="Global score" value={(global.score ?? 0).toFixed(2)} accent />
            <ProfileMetric label="Global rank" value={global.rank != null ? `#${global.rank}` : "Unranked"} />
            <ProfileMetric label="Consistency days" value={String(global.consistencyDays ?? 0)} />
            <ProfileMetric label="Total games" value={String(totalGames)} />
            <ProfileMetric label="Consistency contribution" value={`${(breakdown.consistency ?? 0).toFixed(0)}%`} />
            <ProfileMetric label="Activity contribution" value={`${(breakdown.activity ?? 0).toFixed(0)}%`} />
          </div>
        </ProfileSection>
      </div>

      <ProfileSection
        title="How this rank is calculated"
        subtitle="Transparent explanation generated from weighted profile contributions"
      >
        <p className="text-base leading-relaxed text-foreground/75">
          {data.rankingExplanation ?? "No explanation available."}
        </p>
      </ProfileSection>

      <ProfileSection title="Recent Activity" subtitle="Latest completed games and outcomes">
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
                  {entry.type === "typing" ? "Typing race" : "NPAT"} · {prettyDateTime(entry.finishedAt)}
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
      </ProfileSection>

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
