"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../../../components/Button.jsx";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "place", label: "Place" },
  { key: "animal", label: "Animal" },
  { key: "thing", label: "Thing" },
];

const EMPTY_NOTE_COPY = "No written note was left for this answer.";

/**
 * @param {unknown} score
 */
function scoreCellClass(score) {
  if (score === 10) return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
  if (score === 5) return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (score === 0) return "bg-red-50 text-red-900 ring-1 ring-red-200/70";
  return "bg-ink/[0.04] text-ink-muted ring-1 ring-ink/10";
}

/**
 * @param {{ room: Record<string, unknown> | null, rounds: Array<Record<string, unknown>> }} props
 */
export function ResultsCarousel({ room, rounds }) {
  const sorted = useMemo(
    () => [...rounds].sort((a, b) => (a.roundIndex ?? 0) - (b.roundIndex ?? 0)),
    [rounds],
  );

  const [playerIdx, setPlayerIdx] = useState(0);

  /** Stable player order: lobby order first, then any extra ids from submissions. */
  const allPlayerIds = useMemo(() => {
    const order = [];
    const seen = new Set();
    if (Array.isArray(room?.players)) {
      for (const p of room.players) {
        if (p?.userId && !seen.has(p.userId)) {
          seen.add(p.userId);
          order.push(p.userId);
        }
      }
    }
    for (const r of sorted) {
      const subs = r.submissions && typeof r.submissions === "object" ? r.submissions : {};
      for (const id of Object.keys(subs)) {
        if (!seen.has(id)) {
          seen.add(id);
          order.push(id);
        }
      }
    }
    return order;
  }, [sorted, room?.players]);

  const maxPlayerIdx = allPlayerIds.length > 0 ? allPlayerIds.length - 1 : 0;
  const safePlayerIdx = Math.min(Math.max(0, playerIdx), maxPlayerIdx);
  const uid = allPlayerIds[safePlayerIdx] ?? null;

  const displayName =
    uid && Array.isArray(room?.players)
      ? room.players.find((p) => p.userId === uid)?.username ?? `Player ${uid.slice(-4)}`
      : uid
        ? `Player ${uid.slice(-4)}`
        : "—";

  const leaderboard = useMemo(() => {
    const totals = new Map();
    for (const r of sorted) {
      const ev = r.evaluation;
      if (!ev || typeof ev !== "object") continue;
      const results = /** @type {{ results?: Array<{ playerId?: string, totalScore?: number }> }} */ (ev)
        .results;
      if (!Array.isArray(results)) continue;
      for (const row of results) {
        const id = row.playerId;
        if (!id) continue;
        const t = typeof row.totalScore === "number" ? row.totalScore : 0;
        totals.set(id, (totals.get(id) ?? 0) + t);
      }
    }
    const pl = room?.players;
    const list = [...totals.entries()].map(([id, score]) => ({
      id,
      name: Array.isArray(pl) ? pl.find((p) => p.userId === id)?.username ?? id.slice(-4) : id,
      score,
    }));
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [sorted, room?.players]);

  const goPlayer = useCallback(
    (delta) => {
      if (allPlayerIds.length === 0) return;
      setPlayerIdx((i) => (i + delta + allPlayerIds.length) % allPlayerIds.length);
    },
    [allPlayerIds.length],
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPlayer(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPlayer(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPlayer]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-[var(--radius-2xl)] bg-background/85 p-10 text-center shadow-[var(--shadow-card)] ring-2 ring-muted-bright/60">
        <p className="font-semibold text-ink">No completed rounds in this game.</p>
        <p className="mt-2 text-sm text-ink-muted">If you ended before the first letter, there is nothing to show yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {leaderboard.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-foreground/10 bg-background/85 p-4 shadow-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Total scores</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {leaderboard.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-lg border border-ink/10 bg-ink/[0.02] px-3 py-1.5 text-sm"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink/[0.06] text-[11px] font-black text-ink-muted">
                  {i + 1}
                </span>
                <span className="font-bold text-ink">{e.name}</span>
                <span className="tabular-nums font-black text-accent">{e.score}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ) : null}

      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 rounded-xl border border-foreground/10 bg-background/95 p-4 shadow-md backdrop-blur-sm ring-1 ring-foreground/10 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Answers for</span>
          <select
            className="w-full max-w-md rounded-lg border border-foreground/10 bg-background py-2 pl-3 pr-8 text-sm font-semibold text-ink shadow-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:max-w-lg"
            value={uid ?? ""}
            onChange={(e) => {
              const next = allPlayerIds.indexOf(e.target.value);
              setPlayerIdx(next >= 0 ? next : 0);
            }}
          >
            {allPlayerIds.map((id) => {
              const name = Array.isArray(room?.players)
                ? room.players.find((p) => p.userId === id)?.username ?? `Player ${id.slice(-4)}`
                : id.slice(-4);
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" className="text-sm" onClick={() => goPlayer(-1)}>
            ← Prev
          </Button>
          <Button type="button" variant="secondary" className="text-sm" onClick={() => goPlayer(1)}>
            Next →
          </Button>
        </div>
      </div>

      <p className="-mt-4 text-center text-xs font-medium text-ink-muted sm:text-left">
        Showing <span className="font-bold text-ink">{displayName}</span> across every round. Tip: ← → to switch
        players.
      </p>

      <div className="flex flex-col gap-12">
        {sorted.map((round, idx) => {
          const letter = typeof round?.letter === "string" ? round.letter : "—";
          const ri = typeof round?.roundIndex === "number" ? round.roundIndex : idx;
          const evalPending = round?.evaluationStatus === "pending";
          const evalSource = typeof round?.evaluationSource === "string" ? round.evaluationSource : null;

          const row =
            uid && round?.submissions && typeof round.submissions === "object"
              ? /** @type {Record<string, string>} */ (round.submissions)[uid] ?? {}
              : {};

          const evalRow = (() => {
            if (!uid || !round) return null;
            const ev = round.evaluation;
            if (!ev || typeof ev !== "object") return null;
            const results = /** @type {{ results?: Array<{ playerId?: string }> }} */ (ev).results;
            if (!Array.isArray(results)) return null;
            return results.find((x) => x.playerId === uid) ?? null;
          })();

          return (
            <section
              key={ri}
              className="scroll-mt-28 rounded-xl border border-foreground/10 bg-background/95 shadow-sm ring-1 ring-foreground/10"
              aria-labelledby={`npat-round-title-${ri}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-ink/[0.02] px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Round {idx + 1}</p>
                  <h2 id={`npat-round-title-${ri}`} className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight text-accent sm:text-5xl">{letter}</span>
                    <span className="text-sm font-semibold text-ink-muted">Letter</span>
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {evalPending ? (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-900">
                      Scoring…
                    </span>
                  ) : null}
                  {evalSource ? (
                    <span className="rounded-md bg-ink/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase text-ink-muted">
                      {evalSource === "gemini" ? "AI scored" : "Rules scored"}
                    </span>
                  ) : null}
                  {evalRow && typeof evalRow.totalScore === "number" ? (
                    <span className="rounded-md bg-accent/10 px-2.5 py-1 text-xs font-black text-accent ring-1 ring-accent/20">
                      Round {evalRow.totalScore} pts
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[min(100%,720px)] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 bg-ink/[0.035]">
                      <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Field
                      </th>
                      <th className="min-w-[8rem] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Answer
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Score
                      </th>
                      <th className="min-w-[12rem] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(({ key, label }) => {
                      const cell =
                        evalRow?.answers && typeof evalRow.answers === "object"
                          ? /** @type {Record<string, { value?: string, score?: number, comment?: string }>} */ (
                              evalRow.answers
                            )[key]
                          : null;
                      const sc = typeof cell?.score === "number" ? cell.score : null;
                      const rawComment = typeof cell?.comment === "string" ? cell.comment : "";
                      const answerText = row[key]?.trim() ? row[key] : "—";
                      const noteText = rawComment.trim() ? rawComment : EMPTY_NOTE_COPY;
                      return (
                        <tr key={key} className="border-b border-ink/[0.06] transition-colors hover:bg-ink/[0.02]">
                          <td className="whitespace-nowrap px-4 py-3 align-top font-semibold text-ink">{label}</td>
                          <td className="px-4 py-3 align-top font-medium text-ink">
                            <span className="break-words">{answerText}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                            <span
                              className={`inline-flex min-w-[2.75rem] justify-center rounded-md px-2 py-1 text-xs font-black tabular-nums ${scoreCellClass(sc)}`}
                            >
                              {sc != null ? `${sc}` : "—"}
                            </span>
                          </td>
                          <td className="max-w-md px-4 py-3 align-top text-sm leading-relaxed text-ink/85">{noteText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
