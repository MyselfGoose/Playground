"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLeaderboard, useMyStats } from "../../hooks/useLeaderboard.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";

const BOARDS = [
  {
    key: "global",
    label: "Global",
    subtitle: "Composite ranking across all games",
    explainer:
      "Global ranking combines typing, NPAT, Taboo, Cards Against Humanity, overall activity, and consistency. A minimum of 5 total games across those modes is required.",
  },
  {
    key: "typing-wpm",
    label: "Typing: Speed",
    subtitle: "Ranked by best WPM",
    explainer: "Typing speed ranking is based on each player's best WPM, with at least 3 typing games required to appear.",
  },
  {
    key: "typing-accuracy",
    label: "Typing: Accuracy",
    subtitle: "Ranked by weighted accuracy",
    explainer: "Typing accuracy ranking uses weighted accuracy over total typed characters, with at least 3 typing games required.",
  },
  {
    key: "npat",
    label: "NPAT",
    subtitle: "Ranked by average score per game",
    explainer: "NPAT ranking is based on average AI-evaluated score per game, with at least 2 NPAT games required to appear.",
  },
  {
    key: "taboo",
    label: "Taboo",
    subtitle: "Ranked by individual contribution score",
    explainer: "Taboo ranking is based on speaking skill, guessing accuracy, win consistency, and fair-play penalties (taboo violations). Minimum 3 completed Taboo games required.",
  },
  {
    key: "cah",
    label: "CAH",
    subtitle: "Cards Against Humanity — composite skill",
    explainer:
      "Rankings emphasize composite score from round win rate, average round wins per completed game, and experience. Judge rounds count toward activity but not submitter win rate. Minimum 4 completed CAH games required.",
  },
  {
    key: "hangman",
    label: "Hangman",
    subtitle: "Ranked by skill, win rate, and guessing efficiency",
    explainer:
      "Ranking is based on win rate, accuracy, and efficiency with anti-abuse normalization and minimum 5 completed Hangman games.",
  },
];

function primaryMetric(board, entry, { cahSort } = {}) {
  if (board === "global") return { label: "Score", value: (entry.globalScore ?? 0).toFixed(1) };
  if (board === "typing-wpm") return { label: "WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) };
  if (board === "typing-accuracy") return { label: "Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` };
  if (board === "npat") return { label: "Avg Score", value: (entry.npat_averageScore ?? 0).toFixed(1) };
  if (board === "taboo") return { label: "Score", value: (entry.taboo_score ?? 0).toFixed(1) };
  if (board === "cah") {
    if (cahSort === "wins") return { label: "Round wins", value: String(entry.cah_roundWins ?? 0) };
    if (cahSort === "winRate") return { label: "Win rate", value: `${(entry.cah_winRate ?? 0).toFixed(1)}%` };
    return { label: "Score", value: (entry.cah_score ?? 0).toFixed(1) };
  }
  if (board === "hangman") return { label: "Skill", value: (entry.hangman_skill ?? 0).toFixed(1) };
  return { label: "Score", value: "—" };
}

function boardStats(board, entry) {
  if (board === "typing-wpm") {
    return [
      { label: "Best WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) },
      { label: "Weighted Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` },
      { label: "Typing Games", value: String(entry.typing_totalGames ?? 0) },
      { label: "Race Wins", value: String(entry.typing_multiWins ?? 0) },
    ];
  }
  if (board === "typing-accuracy") {
    return [
      { label: "Weighted Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` },
      { label: "Best WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) },
      { label: "Typing Games", value: String(entry.typing_totalGames ?? 0) },
      { label: "Typed Chars", value: String(entry.typing_totalCharsTyped ?? 0) },
    ];
  }
  if (board === "npat") {
    return [
      { label: "Avg Score", value: (entry.npat_averageScore ?? 0).toFixed(1) },
      { label: "Win Rate", value: `${(entry.npat_winRate ?? 0).toFixed(1)}%` },
      { label: "NPAT Games", value: String(entry.npat_totalGames ?? 0) },
      { label: "NPAT Wins", value: String(entry.npat_wins ?? 0) },
    ];
  }
  if (board === "taboo") {
    return [
      { label: "Score", value: (entry.taboo_score ?? 0).toFixed(1) },
      { label: "Win Rate", value: `${(entry.taboo_winRate ?? 0).toFixed(1)}%` },
      { label: "Guess Accuracy", value: `${(entry.taboo_guessAccuracy ?? 0).toFixed(1)}%` },
      { label: "Speaker Success", value: `${(entry.taboo_speakerSuccessRate ?? 0).toFixed(1)}%` },
    ];
  }
  if (board === "cah") {
    return [
      { label: "Composite score", value: (entry.cah_score ?? 0).toFixed(1) },
      { label: "Round wins", value: String(entry.cah_roundWins ?? 0) },
      { label: "Win rate", value: `${(entry.cah_winRate ?? 0).toFixed(1)}%` },
      { label: "Games finished", value: String(entry.cah_gamesPlayed ?? 0) },
    ];
  }
  if (board === "hangman") {
    return [
      { label: "Skill", value: (entry.hangman_skill ?? 0).toFixed(1) },
      { label: "Win Rate", value: `${(entry.hangman_winRate ?? 0).toFixed(1)}%` },
      { label: "Accuracy", value: `${(entry.hangman_accuracy ?? 0).toFixed(1)}%` },
      { label: "Games", value: String(Math.round(entry.hangman_totalGames ?? 0)) },
    ];
  }
  return [
    { label: "Global Score", value: (entry.globalScore ?? 0).toFixed(1) },
    { label: "Typing Skill", value: `${(entry.breakdown?.typing ?? 0).toFixed(0)}%` },
    { label: "NPAT Skill", value: `${(entry.breakdown?.npat ?? 0).toFixed(0)}%` },
    { label: "Active Days", value: String(entry.activeDaysLast30 ?? 0) },
  ];
}

function contributionBreakdown(entry) {
  const breakdown = entry.breakdown ?? {
    typing: Math.round(Math.min((entry.typing_bestWpm ?? 0) / 150, 1) * 100),
    accuracy: Math.round(entry.typing_weightedAccuracy ?? 0),
    npat: Math.round(Math.min((entry.npat_averageScore ?? 0) / 35, 1) * 100),
    taboo: Math.round(entry.taboo_score ?? 0),
    cah: Math.round(entry.cah_score ?? 0),
    hangman: Math.round(entry.hangman_skill ?? 0),
    activity: Math.round(Math.min((entry.totalGames ?? 0) / 100, 1) * 100),
    consistency: 0,
  };
  return breakdown;
}

function badgeFor(entry) {
  if ((entry.totalGames ?? 0) <= 3) return "New Player";
  if ((entry.npat_winRate ?? 0) >= 70) return "High Win Rate";
  if ((entry.taboo_score ?? 0) >= 80) return "Elite Taboo";
  if ((entry.cah_score ?? 0) >= 75 && (entry.cah_gamesPlayed ?? 0) >= 4) return "CAH Sharp";
  if ((entry.hangman_skill ?? 0) >= 75 && (entry.hangman_totalGames ?? 0) >= 5) return "Hangman Ace";
  if ((entry.typing_bestWpm ?? 0) >= 100) return "Speedster";
  return null;
}

function explanationFromBreakdown(entry) {
  const breakdown = contributionBreakdown(entry);
  const topTwo = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([key]) => key);
  const label = {
    typing: "typing speed",
    accuracy: "accuracy",
    npat: "NPAT performance",
    taboo: "Taboo contribution",
    cah: "Cards Against Humanity skill",
    hangman: "Hangman skill",
    activity: "overall activity",
    consistency: "consistency",
  };
  return `High rank due to strong ${label[topTwo[0]] ?? "performance"} and ${label[topTwo[1]] ?? "activity"}.`;
}

export default function LeaderboardPage() {
  const [activeBoard, setActiveBoard] = useState("global");
  const [page, setPage] = useState(1);
  const [cahSort, setCahSort] = useState("score");
  const [expandedId, setExpandedId] = useState(null);
  const leaderboardOptions = activeBoard === "cah" ? { sort: cahSort } : {};
  const { loading, error, data } = useLeaderboard(activeBoard, page, leaderboardOptions);
  const { user } = useUser();
  const myStats = useMyStats();

  const switchBoard = useCallback((key) => {
    setActiveBoard(key);
    setPage(1);
    if (key !== "cah") setCahSort("score");
  }, []);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const total = data?.total ?? 0;

  const myRank = (() => {
    if (!myStats.data) return null;
    if (activeBoard === "global") return myStats.data.global?.rank;
    if (activeBoard === "typing-wpm") return myStats.data.typing?.wpmRank;
    if (activeBoard === "typing-accuracy") return myStats.data.typing?.accuracyRank;
    if (activeBoard === "npat") return myStats.data.npat?.npatRank;
    if (activeBoard === "taboo") return myStats.data.taboo?.tabooRank;
    if (activeBoard === "cah") return myStats.data.cah?.cahRank;
    if (activeBoard === "hangman") return myStats.data.hangman?.hangmanRank;
    return null;
  })();

  const boardMeta = BOARDS.find((b) => b.key === activeBoard) ?? BOARDS[0];

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Fixed Header with Board Selector */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-muted-bright/30 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Board tabs - horizontal scroll */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 mb-6">
            {BOARDS.map((b) => (
              <button
                key={b.key}
                onClick={() => switchBoard(b.key)}
                className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-extrabold whitespace-nowrap transition-all duration-300 ${
                  activeBoard === b.key
                    ? "bg-primary text-white shadow-[var(--shadow-play)] scale-105"
                    : "bg-muted-bright/40 text-foreground ring-1 ring-muted-bright/50 hover:ring-primary/50 hover:bg-muted-bright/60"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Page title */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">{boardMeta.label}</h1>
          <p className="mt-1 text-base text-foreground/70">{boardMeta.subtitle}</p>
          <p className="mt-3 max-w-2xl text-sm text-foreground/65">{boardMeta.explainer}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* User's Rank Position */}
        {user && myRank != null ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 p-4 rounded-[var(--radius-xl)] bg-gradient-to-r from-accent-lemon/20 via-accent-pink/20 to-primary/20 ring-2 ring-accent-lemon/40 border border-accent-lemon/30"
          >
            <p className="text-center font-extrabold text-foreground">
              <span className="text-2xl">📍</span> You&apos;re ranked <span className="text-primary">#{myRank}</span> on this board
            </p>
          </motion.div>
        ) : null}

        {activeBoard === "cah" ? (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            <label htmlFor="cah-sort" className="text-sm font-bold text-foreground/70">
              Sort by
            </label>
            <select
              id="cah-sort"
              value={cahSort}
              onChange={(e) => {
                setCahSort(e.target.value);
                setPage(1);
              }}
              className="rounded-full border border-muted-bright/40 bg-background px-4 py-2 text-sm font-bold text-foreground ring-1 ring-muted-bright/50"
            >
              <option value="score">Composite score</option>
              <option value="wins">Round wins</option>
              <option value="winRate">Win rate</option>
            </select>
          </div>
        ) : null}

        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-muted text-lg font-bold">Loading rankings…</div>
        ) : error ? (
          <div className="rounded-[var(--radius-2xl)] bg-error/5 px-6 py-8 text-center text-sm font-bold text-error border border-error/20">{error}</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-3xl">🏆</p>
            <p className="text-2xl font-extrabold text-foreground">No rankings yet</p>
            <p className="text-base text-foreground/70 max-w-sm">Be the first to play and claim the top spot!</p>
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM SPOTLIGHT */}
            <TopThreePodium entries={entries} board={activeBoard} cahSort={cahSort} />

            {/* REST OF THE RANKINGS - FLOWING FEED */}
            <div className="mt-16">
              <h2 className="text-xl font-extrabold text-foreground mb-6 text-center">The Chase</h2>
              <div className="space-y-4 max-w-2xl mx-auto">
                {entries.slice(3).map((entry, index) => {
                  const pm = primaryMetric(activeBoard, entry, { cahSort });
                  const badge = badgeFor(entry);
                  const expanded = expandedId === entry.userId;
                  const stats = boardStats(activeBoard, entry);
                  const breakdown = contributionBreakdown(entry);

                  return (
                    <motion.article
                      key={entry.userId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : entry.userId)}
                    >
                      {/* Main card */}
                      <div className="rounded-[var(--radius-xl)] bg-gradient-to-r from-background via-muted-bright/20 to-transparent p-5 ring-2 ring-muted-bright/40 transition-all duration-300 group-hover:ring-primary/40 group-hover:bg-gradient-to-r group-hover:from-background group-hover:via-primary/10 group-hover:to-accent-pink/5">
                        <div className="flex items-center gap-4">
                          {/* Rank badge */}
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-muted-bright/40 font-extrabold text-foreground text-sm group-hover:bg-primary/20 group-hover:text-primary transition-all duration-300">
                            #{entry.rank}
                          </div>

                          {/* Player info */}
                          <Link
                            href={`/profile/${entry.userId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-0 flex-1"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar username={entry.username} src={entry.avatarUrl} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">{entry.username}</p>
                                {badge ? (
                                  <span className="inline-flex rounded-full bg-accent-lemon/20 px-2 py-0.5 text-xs font-bold text-foreground ring-1 ring-accent-lemon/40">
                                    {badge}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </Link>

                          {/* Primary metric - large and prominent */}
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">{pm.label}</p>
                            <p className="text-2xl font-black text-primary">{pm.value}</p>
                          </div>
                        </div>

                        {/* Mini stats row */}
                        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                          {stats.slice(0, 4).map((s) => (
                            <div key={s.label} className="text-center">
                              <p className="text-muted font-bold">{s.label}</p>
                              <p className="font-extrabold text-foreground mt-0.5">{s.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-2 overflow-hidden"
                          >
                            <div className="rounded-[var(--radius-lg)] bg-accent-lemon/5 p-4 ring-1 ring-accent-lemon/40">
                              <p className="text-sm text-foreground/70 leading-relaxed mb-4">{explanationFromBreakdown(entry)}</p>
                              
                              {activeBoard === "global" ? (
                                <>
                                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Breakdown</p>
                                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                    <Metric label="Typing" value={`${breakdown.typing.toFixed(0)}%`} />
                                    <Metric label="Accuracy" value={`${breakdown.accuracy.toFixed(0)}%`} />
                                    <Metric label="NPAT" value={`${breakdown.npat.toFixed(0)}%`} />
                                    <Metric label="Taboo" value={`${(breakdown.taboo ?? 0).toFixed(0)}%`} />
                                    <Metric label="CAH" value={`${(breakdown.cah ?? 0).toFixed(0)}%`} />
                                    <Metric label="Hangman" value={`${(breakdown.hangman ?? 0).toFixed(0)}%`} />
                                    <Metric label="Activity" value={`${breakdown.activity.toFixed(0)}%`} />
                                    <Metric label="Consistency" value={`${breakdown.consistency.toFixed(0)}%`} />
                                  </div>
                                </>
                              ) : null}

                              <Link
                                href={`/profile/${entry.userId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary-dark"
                              >
                                View full profile
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {total > 25 ? (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full px-5 py-2 text-sm font-bold text-foreground ring-2 ring-muted-bright transition hover:bg-muted-bright disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-sm font-bold text-foreground/60 min-w-[4rem] text-center">Page {page}</span>
          <button
            disabled={page * 25 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full px-5 py-2 text-sm font-bold text-foreground ring-2 ring-muted-bright transition hover:bg-muted-bright disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TopThreePodium({ entries, board, cahSort }) {
  const top3 = entries.slice(0, 3);

  // Position: 2nd, 1st, 3rd (visual arrangement for podium effect)
  const podiumOrder = [
    { index: 1, position: "left", height: "h-32" },
    { index: 0, position: "center", height: "h-48" },
    { index: 2, position: "right", height: "h-24" },
  ];

  return (
    <div className="relative mx-auto max-w-2xl mb-16">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-foreground">Elite Leaders</h2>
        <p className="text-sm text-foreground/60 mt-1">The champions above all</p>
      </div>

      <div className="relative flex items-end justify-center gap-4 h-56 perspective">
        {podiumOrder.map(({ index, position, height }) => {
          const entry = top3[index];
          if (!entry) return null;

          const medals = ["🥇", "🥈", "🥉"];
          const metric = primaryMetric(board, entry, { cahSort });
          const isFirst = index === 0;

          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
                delay: index * 0.15,
              }}
              whileHover={{ y: -8 }}
              className={`relative flex-1 max-w-xs ${position === "center" ? "order-2" : position === "left" ? "order-1" : "order-3"}`}
            >
              {/* Podium base */}
              <div
                className={`${height} rounded-t-[var(--radius-xl)] transition-all duration-300 ${
                  isFirst
                    ? "bg-gradient-to-b from-primary/40 via-primary/20 to-primary/10 ring-2 ring-primary/60 shadow-[0_-4px_16px_rgba(255,107,91,0.3)]"
                    : "bg-gradient-to-b from-muted-bright/40 to-muted-bright/10 ring-2 ring-muted-bright/50"
                }`}
              />

              {/* Card floating above podium */}
              <Link
                href={`/profile/${entry.userId}`}
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-xs"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`rounded-[var(--radius-2xl)] p-4 ring-2 ${
                    isFirst
                      ? "bg-gradient-to-br from-primary/30 to-accent-pink/20 ring-primary/60 shadow-[var(--shadow-play)]"
                      : "bg-background ring-muted-bright/60 shadow-[var(--shadow-md)]"
                  } text-center`}
                >
                  <div className="text-3xl mb-2">{medals[index]}</div>
                  <Avatar
                    username={entry.username}
                    src={entry.avatarUrl}
                    size="md"
                    className="mx-auto mb-2"
                  />
                  <p className="font-extrabold text-foreground text-sm truncate">
                    {entry.username}
                  </p>
                  <p className={`text-2xl font-black mt-2 ${isFirst ? "text-primary" : "text-foreground"}`}>
                    {metric.value}
                  </p>
                  <p className="text-xs text-foreground/60 uppercase tracking-wide font-bold mt-1">
                    {metric.label}
                  </p>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-muted-bright/30 px-3 py-2.5 ring-1 ring-muted-bright/40 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}
