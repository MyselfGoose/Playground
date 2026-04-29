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
];

function primaryMetric(board, entry) {
  if (board === "global") return { label: "Score", value: (entry.globalScore ?? 0).toFixed(1) };
  if (board === "typing-wpm") return { label: "WPM", value: (entry.typing_bestWpm ?? 0).toFixed(1) };
  if (board === "typing-accuracy") return { label: "Accuracy", value: `${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%` };
  if (board === "npat") return { label: "Avg Score", value: (entry.npat_averageScore ?? 0).toFixed(1) };
  return { label: "Score", value: "—" };
}

function contributionBreakdown(entry) {
  const breakdown = entry.breakdown ?? {
    typing: Math.round(Math.min((entry.typing_bestWpm ?? 0) / 150, 1) * 100),
    accuracy: Math.round(entry.typing_weightedAccuracy ?? 0),
    npat: Math.round(Math.min((entry.npat_averageScore ?? 0) / 35, 1) * 100),
    activity: Math.round(Math.min((entry.totalGames ?? 0) / 100, 1) * 100),
    consistency: 0,
  };
  return breakdown;
}

function badgeFor(entry) {
  if ((entry.totalGames ?? 0) <= 3) return "New Player";
  if ((entry.npat_winRate ?? 0) >= 70) return "High Win Rate";
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
    return null;
  })();

  const boardMeta = BOARDS.find((b) => b.key === activeBoard) ?? BOARDS[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:py-10">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{boardMeta.label}</h1>
        <p className="mt-1 text-sm font-medium text-ink-muted">{boardMeta.subtitle}</p>
        {user && myRank != null ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            You are #{myRank}
          </p>
        ) : null}
      </div>

      <section className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-extrabold text-ink">How this ranking works</h2>
        <p className="mt-2 text-sm text-ink-muted">{boardMeta.explainer}</p>
      </section>

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
        <div className="space-y-4">
          {entries.map((entry) => {
            const pm = primaryMetric(activeBoard, entry);
            const breakdown = contributionBreakdown(entry);
            const badge = badgeFor(entry);
            const expanded = expandedId === entry.userId;
            return (
              <article
                key={entry.userId}
                className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-xl font-extrabold text-accent">
                    #{entry.rank}
                  </div>
                  <Link href={`/profile/${entry.userId}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Avatar username={entry.username} src={entry.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-extrabold text-ink">{entry.username}</p>
                        {badge ? (
                          <span className="inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{pm.label}</p>
                    <p className="text-xl font-extrabold text-ink">{pm.value}</p>
                  </div>
                </div>

                <p className="mt-3 text-sm text-ink-muted">{explanationFromBreakdown(entry)}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Metric label="Accuracy" value={`${(entry.typing_weightedAccuracy ?? 0).toFixed(1)}%`} />
                  <Metric label="Games" value={String(entry.totalGames ?? 0)} />
                  <Metric label="Win rate" value={`${(entry.npat_winRate ?? 0).toFixed(0)}%`} />
                  <Metric label="Consistency" value={`${(breakdown.consistency ?? 0).toFixed(0)}%`} />
                </div>

                <button
                  type="button"
                  className="mt-3 rounded-xl px-3 py-1.5 text-xs font-bold text-accent ring-1 ring-accent/20"
                  onClick={() => setExpandedId(expanded ? null : entry.userId)}
                >
                  {expanded ? "Hide details" : "More details"}
                </button>

                {expanded ? (
                  <div className="mt-3 rounded-2xl bg-surface px-3 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Contribution breakdown</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                      <Metric label="Typing" value={`${breakdown.typing.toFixed(0)}%`} />
                      <Metric label="Accuracy" value={`${breakdown.accuracy.toFixed(0)}%`} />
                      <Metric label="NPAT" value={`${breakdown.npat.toFixed(0)}%`} />
                      <Metric label="Activity" value={`${breakdown.activity.toFixed(0)}%`} />
                      <Metric label="Consistency" value={`${breakdown.consistency.toFixed(0)}%`} />
                    </div>
                    <Link
                      href={`/profile/${entry.userId}`}
                      className="mt-3 inline-flex rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Open profile
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {total > 25 ? (
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
      ) : null}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-ink/5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}
