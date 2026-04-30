"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useLeaderboard, useMyStats } from "../../hooks/useLeaderboard.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";

const BOARDS = [
  {
    key: "global",
    label: "Global",
    subtitle: "Composite ranking across all games",
    explainer: "Global ranking combines typing skill, NPAT skill, activity, and consistency. A minimum of 5 total games is required.",
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
];

function primaryMetric(board, entry) {
  if (board === "global") return { label: "Score", value: (entry.globalScore ?? 0).toFixed(1) };
  if (board === "typing-wpm") return { label: "WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) };
  if (board === "typing-accuracy") return { label: "Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` };
  if (board === "npat") return { label: "Avg Score", value: (entry.npat_averageScore ?? 0).toFixed(1) };
  if (board === "taboo") return { label: "Score", value: (entry.taboo_score ?? 0).toFixed(1) };
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
    activity: Math.round(Math.min((entry.totalGames ?? 0) / 100, 1) * 100),
    consistency: 0,
  };
  return breakdown;
}

function badgeFor(entry) {
  if ((entry.totalGames ?? 0) <= 3) return "New Player";
  if ((entry.npat_winRate ?? 0) >= 70) return "High Win Rate";
  if ((entry.taboo_score ?? 0) >= 80) return "Elite Taboo";
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
    activity: "overall activity",
    consistency: "consistency",
  };
  return `High rank due to strong ${label[topTwo[0]] ?? "performance"} and ${label[topTwo[1]] ?? "activity"}.`;
}

export default function LeaderboardPage() {
  const [activeBoard, setActiveBoard] = useState("global");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const { loading, error, data } = useLeaderboard(activeBoard, page);
  const { user } = useUser();
  const myStats = useMyStats();

  const switchBoard = useCallback((key) => {
    setActiveBoard(key);
    setPage(1);
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
    return null;
  })();

  const boardMeta = BOARDS.find((b) => b.key === activeBoard) ?? BOARDS[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:py-16">
      {/* Board selector */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => switchBoard(b.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold whitespace-nowrap transition-all ${
              activeBoard === b.key
                ? "bg-primary text-white shadow-[var(--shadow-play)]"
                : "bg-muted-bright/50 text-foreground ring-1 ring-muted-bright/40 hover:bg-muted-bright"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">{boardMeta.label}</h1>
        <p className="mt-2 text-lg text-foreground/70">{boardMeta.subtitle}</p>
        {user && myRank != null ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/10 to-accent-pink/10 px-4 py-2 ring-1 ring-primary/30">
            <span className="text-2xl">📍</span>
            <span className="text-sm font-extrabold text-primary">You are ranked #{myRank}</span>
          </div>
        ) : null}
      </div>

      {/* Explainer section */}
      <section className="mb-8 rounded-[var(--radius-2xl)] bg-gradient-to-br from-muted-bright/30 to-transparent p-6 ring-2 ring-muted-bright/40">
        <h2 className="text-base font-extrabold text-foreground">📖 How this ranking works</h2>
        <p className="mt-3 text-sm text-foreground/70 leading-relaxed">{boardMeta.explainer}</p>
      </section>

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted text-lg font-bold">Loading rankings…</div>
      ) : error ? (
        <div className="rounded-[var(--radius-2xl)] bg-error/5 px-6 py-8 text-center text-sm font-bold text-error border border-error/20">{error}</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-2xl font-extrabold text-foreground">No rankings yet</p>
          <p className="text-base text-foreground/70">Be the first to play and claim the top spot!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => {
            const pm = primaryMetric(activeBoard, entry);
            const breakdown = contributionBreakdown(entry);
            const badge = badgeFor(entry);
            const expanded = expandedId === entry.userId;
            const stats = boardStats(activeBoard, entry);
            const getMedal = () => {
              if (entry.rank === 1) return "🥇";
              if (entry.rank === 2) return "🥈";
              if (entry.rank === 3) return "🥉";
              return null;
            };
            return (
              <article
                key={entry.userId}
                className="rounded-[var(--radius-2xl)] bg-gradient-to-r from-muted-bright/20 to-transparent p-5 ring-2 ring-muted-bright/40 transition-all hover:ring-primary/40 hover:scale-102"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-primary/20 to-accent-pink/20 text-2xl font-extrabold">
                    {getMedal() || `#${entry.rank}`}
                  </div>
                  <Link href={`/profile/${entry.userId}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Avatar username={entry.username} src={entry.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-extrabold text-foreground">{entry.username}</p>
                        {badge ? (
                          <span className="inline-flex rounded-full bg-accent-lemon/30 px-2 py-0.5 text-[10px] font-bold text-foreground ring-1 ring-accent-lemon/40">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{pm.label}</p>
                    <p className="text-2xl font-extrabold bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">{pm.value}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-foreground/70 leading-relaxed">{explanationFromBreakdown(entry)}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {stats.map((s) => (
                    <Metric key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-xs font-bold text-primary ring-2 ring-primary/30 transition-all hover:ring-primary/60"
                    onClick={() => setExpandedId(expanded ? null : entry.userId)}
                  >
                    {expanded ? "Hide details" : "Show more"}
                  </button>
                  <Link
                    href={`/profile/${entry.userId}`}
                    className="rounded-full px-4 py-2 text-xs font-bold bg-primary text-white transition-all hover:bg-primary-dark"
                  >
                    View profile
                  </Link>
                </div>

                {expanded ? (
                  <div className="mt-4 rounded-[var(--radius-xl)] bg-muted-bright/20 p-4 ring-1 ring-muted-bright/40">
                    {activeBoard === "global" ? (
                      <>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Global contribution breakdown</p>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">
                          <Metric label="Typing" value={`${breakdown.typing.toFixed(0)}%`} />
                          <Metric label="Accuracy" value={`${breakdown.accuracy.toFixed(0)}%`} />
                          <Metric label="NPAT" value={`${breakdown.npat.toFixed(0)}%`} />
                          <Metric label="Taboo" value={`${(breakdown.taboo ?? 0).toFixed(0)}%`} />
                          <Metric label="Activity" value={`${breakdown.activity.toFixed(0)}%`} />
                          <Metric label="Consistency" value={`${breakdown.consistency.toFixed(0)}%`} />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Category insight</p>
                        <p className="text-xs text-foreground/70 leading-relaxed">
                          {activeBoard === "typing-wpm" && "Speed ranking favors high best WPM, with accuracy and race wins as supporting indicators."}
                          {activeBoard === "typing-accuracy" && "Accuracy ranking favors precision over volume; speed is shown as a supporting context signal."}
                          {activeBoard === "npat" && "NPAT ranking favors high average AI-evaluated scores, with win rate and games showing reliability."}
                          {activeBoard === "taboo" && "Taboo ranking favors speaking success, guessing accuracy, and win consistency, with penalties for taboo violations."}
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

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

function Metric({ label, value }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-muted-bright/30 px-3 py-2.5 ring-1 ring-muted-bright/40">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}
