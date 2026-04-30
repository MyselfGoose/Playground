"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";
import { useMyStats } from "../../hooks/useLeaderboard.js";

function StatTile({ label, value, icon }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-muted-bright/30 to-transparent px-6 py-6 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40 text-center"
    >
      {icon && <span className="text-3xl mb-2 block">{icon}</span>}
      <p className="text-3xl font-extrabold bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">{value}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
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
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-muted">
        Loading your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-muted">
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12 text-center sm:py-16"
    >
      {/* Avatar and username */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Avatar username={user.username} src={user.avatarUrl} size="lg" />
      </motion.div>
      
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold text-foreground">{user.username}</h1>
        <p className="mt-2 text-lg text-foreground/70">{user.email}</p>
      </motion.div>

      {/* Main stats */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.3 }}
        className="mt-12 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatTile icon="🎮" label="Games Played" value={statsLoading ? "…" : String(totalGames)} />
        <StatTile icon="⭐" label="Global Score" value={statsLoading ? "…" : globalScore.toFixed(1)} />
        <StatTile icon="🏆" label="Global Rank" value={statsLoading ? "…" : globalRank != null ? `#${globalRank}` : "Unranked"} />
      </motion.div>

      {/* Detailed breakdown */}
      {stats && !statsLoading && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.4 }}
          className="mt-10 w-full max-w-2xl"
        >
          <h2 className="text-lg font-extrabold text-foreground mb-5">Your Stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat icon="⌨️" label="Best WPM" value={(stats.typing?.bestWpm ?? 0).toFixed(1)} />
            <MiniStat icon="🎯" label="Accuracy" value={`${(stats.typing?.weightedAccuracy ?? 0).toFixed(1)}%`} />
            <MiniStat icon="🌍" label="NPAT Avg" value={(stats.npat?.averageScore ?? 0).toFixed(1)} />
            <MiniStat icon="🥇" label="NPAT Wins" value={String(stats.npat?.wins ?? 0)} />
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.5 }}
        className="mt-12 flex flex-wrap items-center justify-center gap-4"
      >
        <Link
          href="/leaderboard"
          className="rounded-full bg-primary px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-play)] transition-all hover:scale-105 active:scale-95"
        >
          📊 View Leaderboard
        </Link>
        <Link
          href="/games"
          className="rounded-full text-sm font-extrabold text-primary ring-2 ring-primary/30 px-6 py-3 transition-all hover:ring-primary/60"
        >
          🎮 Back to Games
        </Link>
      </motion.div>
    </motion.div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.02 }}
      className="rounded-[var(--radius-lg)] bg-gradient-to-br from-muted-bright/20 to-transparent px-3 py-4 ring-1 ring-muted-bright/40 text-center"
    >
      {icon && <span className="text-2xl mb-1 block">{icon}</span>}
      <p className="text-lg font-extrabold text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
