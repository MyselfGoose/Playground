"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";
import { useMyStats } from "../../hooks/useLeaderboard.js";

function StatCard({ label, value, icon, highlight = false }) {
  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.02 }}
      className={`rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-md)] ring-2 transition-all ${
        highlight 
          ? "bg-gradient-to-br from-primary/20 via-accent-pink/10 to-transparent ring-primary/40" 
          : "bg-gradient-to-br from-muted-bright/30 to-transparent ring-muted-bright/40"
      }`}
    >
      {icon && <span className={`text-4xl mb-3 block ${highlight ? "scale-125" : ""}`}>{icon}</span>}
      <p className={`font-extrabold mb-2 ${highlight ? "text-3xl text-primary" : "text-2xl text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{label}</p>
    </motion.div>
  );
}

function StatRow({ label, value, icon }) {
  return (
    <motion.div 
      whileHover={{ x: 4 }}
      className="flex items-center justify-between rounded-[var(--radius-lg)] bg-muted-bright/20 px-4 py-3 ring-1 ring-muted-bright/30"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-bold text-foreground/70">{label}</span>
      </div>
      <span className="text-lg font-extrabold text-primary">{value}</span>
    </motion.div>
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
      (stats.cah?.gamesPlayed ?? 0)
    : 0;
  const globalScore = stats?.global?.score ?? 0;
  const globalRank = stats?.global?.rank;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      {/* Header with user info */}
      <section className="bg-gradient-to-b from-muted-bright/20 to-transparent px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <Avatar username={user.username} src={user.avatarUrl} size="lg" />
            
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <h1 className="text-4xl sm:text-5xl font-black text-foreground">{user.username}</h1>
              <p className="mt-2 text-foreground/60">{user.email}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Main stats showcase */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-3"
          >
            <StatCard 
              icon="🏆" 
              label="Global Rank" 
              value={statsLoading ? "…" : globalRank != null ? `#${globalRank}` : "Unranked"}
              highlight={true}
            />
            <StatCard 
              icon="⭐" 
              label="Overall Score" 
              value={statsLoading ? "…" : globalScore.toFixed(0)}
            />
            <StatCard 
              icon="🎮" 
              label="Games Played" 
              value={statsLoading ? "…" : String(totalGames)}
            />
          </motion.div>
        </div>
      </section>

      {/* Detailed performance breakdown */}
      {stats && !statsLoading && (
        <section className="px-4 py-12 sm:px-6 sm:py-16 bg-muted-bright/10">
          <div className="mx-auto max-w-5xl">
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-2xl font-extrabold text-foreground mb-8">Performance Breakdown</h2>
              
              {/* Typing section */}
              <div className="mb-10">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span>⌨️</span> Typing Race
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatRow 
                    icon="🚀" 
                    label="Best Speed (WPM)" 
                    value={(stats.typing?.bestWpm ?? 0).toFixed(1)}
                  />
                  <StatRow 
                    icon="🎯" 
                    label="Average Accuracy" 
                    value={`${(stats.typing?.weightedAccuracy ?? 0).toFixed(1)}%`}
                  />
                  <StatRow 
                    icon="🏁" 
                    label="Races Completed" 
                    value={String(stats.typing?.totalGames ?? 0)}
                  />
                  <StatRow 
                    icon="👑" 
                    label="Typing Rank" 
                    value={stats.typing?.wpmRank ? `#${stats.typing.wpmRank}` : "Unranked"}
                  />
                </div>
              </div>

              {/* NPAT section */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span>🌍</span> Name Place Animal Thing
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatRow 
                    icon="⭐" 
                    label="Average Score" 
                    value={(stats.npat?.averageScore ?? 0).toFixed(1)}
                  />
                  <StatRow 
                    icon="🥇" 
                    label="Total Wins" 
                    value={String(stats.npat?.wins ?? 0)}
                  />
                  <StatRow 
                    icon="🎮" 
                    label="Games Played" 
                    value={String(stats.npat?.totalGames ?? 0)}
                  />
                  <StatRow 
                    icon="📊" 
                    label="NPAT Rank" 
                    value={stats.npat?.npatRank ? `#${stats.npat.npatRank}` : "Unranked"}
                  />
                </div>
              </div>

              {/* Cards Against Humanity */}
              <div className="mt-10 mb-10">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span>🃏</span> Cards Against Humanity
                </h3>
                <p className="text-xs text-foreground/55 mb-4 max-w-xl">
                  Rankings use composite score from round win rate, average wins per finished game, and games played.
                  At least four finished matches are required to appear on the CAH leaderboard.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatRow
                    icon="🎯"
                    label="Composite score"
                    value={(stats.cah?.score ?? 0).toFixed(1)}
                  />
                  <StatRow
                    icon="🏆"
                    label="Round wins"
                    value={String(stats.cah?.roundWins ?? 0)}
                  />
                  <StatRow
                    icon="📈"
                    label="Win rate (submitter rounds)"
                    value={`${(stats.cah?.winRate ?? 0).toFixed(1)}%`}
                  />
                  <StatRow
                    icon="🎮"
                    label="Games finished"
                    value={String(stats.cah?.gamesPlayed ?? 0)}
                  />
                  <StatRow
                    icon="🔄"
                    label="Rounds played (submit)"
                    value={String(stats.cah?.roundsPlayed ?? 0)}
                  />
                  <StatRow
                    icon="⚖️"
                    label="Rounds judged"
                    value={String(stats.cah?.roundsJudged ?? 0)}
                  />
                  <StatRow
                    icon="📊"
                    label="CAH rank"
                    value={stats.cah?.cahRank ? `#${stats.cah.cahRank}` : "Unranked"}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Call to action */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
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

