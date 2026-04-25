"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLeaderboard, useMyStats } from "../../hooks/useLeaderboard.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";

const BOARDS = [
  { key: "global", label: "Global", color: "accent", subtitle: "Composite ranking across all games" },
  { key: "typing-wpm", label: "Typing: Speed", color: "lavender", subtitle: "Ranked by best WPM" },
  { key: "typing-accuracy", label: "Typing: Accuracy", color: "mint", subtitle: "Ranked by weighted accuracy" },
  { key: "npat", label: "NPAT", color: "peach", subtitle: "Ranked by average score per game" },
];

function primaryMetric(board, entry) {
  if (board === "global") return { label: "Score", value: (entry.globalScore ?? 0).toFixed(1) };
  if (board === "typing-wpm") return { label: "WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) };
  if (board === "typing-accuracy") return { label: "Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` };
  if (board === "npat") return { label: "Avg Score", value: (entry.npat_averageScore ?? 0).toFixed(1) };
  return { label: "Score", value: "—" };
}

function secondaryMetric(board, entry) {
  if (board === "global") return null;
  if (board === "npat") return { label: "Win rate", value: `${(entry.npat_winRate ?? 0).toFixed(0)}%` };
  return { label: "Games", value: String(entry.typing_totalGames ?? entry.totalGames ?? 0) };
}

const podiumColors = [
  "from-amber-300/40 to-amber-100/30 ring-amber-300/50",
  "from-gray-300/40 to-gray-100/30 ring-gray-300/40",
  "from-orange-300/40 to-orange-100/30 ring-orange-300/40",
];
const podiumLabels = ["1st", "2nd", "3rd"];

function minGamesNotice(board) {
  if (board === "typing-wpm" || board === "typing-accuracy") return "Play at least 3 typing games to appear.";
  if (board === "npat") return "Play at least 2 NPAT games to appear.";
  if (board === "global") return "Play at least 5 total games to appear.";
  return "";
}

export default function LeaderboardPage() {
  const [activeBoard, setActiveBoard] = useState("global");
  const [page, setPage] = useState(1);
  const { loading, error, data } = useLeaderboard(activeBoard, page);
  const { user } = useUser();
  const myStats = useMyStats();

  const switchBoard = useCallback((key) => {
    setActiveBoard(key);
    setPage(1);
  }, []);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const top3 = entries.slice(0, page === 1 ? 3 : 0);
  const rest = entries.slice(page === 1 ? 3 : 0);

  const myRank = (() => {
    if (!myStats.data) return null;
    if (activeBoard === "global") return myStats.data.global?.rank;
    if (activeBoard === "typing-wpm") return myStats.data.typing?.wpmRank;
    if (activeBoard === "typing-accuracy") return myStats.data.typing?.accuracyRank;
    if (activeBoard === "npat") return myStats.data.npat?.npatRank;
    return null;
  })();

  const boardMeta = BOARDS.find((b) => b.key === activeBoard) ?? BOARDS[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-8 sm:py-12 lg:gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Leaderboards</p>
          <nav className="flex flex-col gap-1.5">
            {BOARDS.map((b) => (
              <button
                key={b.key}
                onClick={() => switchBoard(b.key)}
                className={`relative rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all ${
                  activeBoard === b.key
                    ? "bg-white text-accent shadow-[var(--shadow-card)] ring-2 ring-accent/20"
                    : "text-ink-muted hover:bg-white/80 hover:text-ink"
                }`}
              >
                {activeBoard === b.key && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl bg-white shadow-[var(--shadow-card)] ring-2 ring-accent/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full bg-${b.color}`} />
                {b.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {BOARDS.map((b) => (
            <button
              key={b.key}
              onClick={() => switchBoard(b.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                activeBoard === b.key
                  ? "bg-accent text-white shadow-sm"
                  : "bg-white/70 text-ink-muted ring-1 ring-ink/10 hover:bg-white"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{boardMeta.label}</h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">{boardMeta.subtitle}</p>
          {user && myRank != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
              You are #{myRank}
            </p>
          )}
          {user && myRank == null && !myStats.loading && (
            <p className="mt-2 text-xs font-medium text-ink-muted">{minGamesNotice(activeBoard)}</p>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeBoard}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-ink-muted">Loading...</div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 px-6 py-8 text-center text-sm font-bold text-red-800">{error}</div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-center">
                <p className="text-lg font-extrabold text-ink">No rankings yet</p>
                <p className="text-sm text-ink-muted">Be the first to play and claim the top spot!</p>
              </div>
            ) : (
              <>
                {/* Top 3 podium */}
                {top3.length > 0 && (
                  <div className="mb-8 grid gap-4 sm:grid-cols-3">
                    {top3.map((entry, i) => {
                      const pm = primaryMetric(activeBoard, entry);
                      const isMe = user && String(entry.userId) === user.id;
                      return (
                        <motion.div
                          key={entry.userId}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
                          className={`relative flex flex-col items-center gap-3 rounded-[var(--radius-2xl)] bg-gradient-to-b p-6 ring-2 ${podiumColors[i]} ${isMe ? "ring-accent/40" : ""}`}
                        >
                          <span className="absolute -top-3 right-3 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink shadow-sm ring-1 ring-ink/10">
                            {podiumLabels[i]}
                          </span>
                          <Avatar username={entry.username} src={entry.avatarUrl} size="md" />
                          <p className="text-sm font-extrabold text-ink">{entry.username}</p>
                          <p className="text-2xl font-extrabold tracking-tight text-ink">{pm.value}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{pm.label}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Table */}
                {rest.length > 0 && (
                  <div className="overflow-hidden rounded-[var(--radius-xl)] bg-white/80 shadow-[var(--shadow-card)] ring-2 ring-white/80">
                    <div className="hidden sm:grid sm:grid-cols-[3.5rem_1fr_7rem_6rem] items-center gap-2 border-b border-ink/5 px-5 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Rank</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Player</span>
                      <span className="text-right text-[10px] font-bold uppercase tracking-widest text-ink-muted">{primaryMetric(activeBoard, rest[0]).label}</span>
                      <span className="text-right text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                        {secondaryMetric(activeBoard, rest[0])?.label ?? ""}
                      </span>
                    </div>
                    {rest.map((entry) => {
                      const pm = primaryMetric(activeBoard, entry);
                      const sm = secondaryMetric(activeBoard, entry);
                      const isMe = user && String(entry.userId) === user.id;
                      return (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 border-b border-ink/5 px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[3.5rem_1fr_7rem_6rem] sm:gap-2 ${
                            isMe ? "bg-accent/[0.06] ring-1 ring-accent/15" : ""
                          }`}
                        >
                          <span className="w-8 shrink-0 text-center text-sm font-extrabold text-ink-muted sm:w-auto sm:text-left">#{entry.rank}</span>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar username={entry.username} src={entry.avatarUrl} size="sm" />
                            <span className="truncate text-sm font-bold text-ink">{entry.username}</span>
                          </div>
                          <span className="ml-auto text-right text-sm font-extrabold text-ink sm:ml-0">{pm.value}</span>
                          {sm && <span className="hidden text-right text-xs font-medium text-ink-muted sm:block">{sm.value}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {total > 25 && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-2xl px-4 py-2 text-sm font-bold text-ink-muted ring-2 ring-ink/10 transition hover:bg-white disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-ink-muted">Page {page}</span>
                    <button
                      disabled={page * 25 >= total}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-2xl px-4 py-2 text-sm font-bold text-ink-muted ring-2 ring-ink/10 transition hover:bg-white disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
