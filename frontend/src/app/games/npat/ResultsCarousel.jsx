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

  const [roundIdx, setRoundIdx] = useState(0);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [noteModal, setNoteModal] = useState(
    /** @type {{ fieldKey: string, fieldLabel: string, answer: string, comment: string } | null} */ (null),
  );

  const round = sorted[roundIdx] ?? null;

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

  const playerIds = useMemo(() => {
    if (!round) return [];
    const subs = round.submissions && typeof round.submissions === "object" ? round.submissions : {};
    const ids = new Set(Object.keys(subs));
    const players = room?.players;
    if (Array.isArray(players)) {
      for (const p of players) {
        if (p?.userId) ids.add(p.userId);
      }
    }
    return [...ids];
  }, [round, room?.players]);

  const maxPlayerIdx = playerIds.length > 0 ? playerIds.length - 1 : 0;
  const safePlayerIdx = Math.min(Math.max(0, playerIdx), maxPlayerIdx);
  const uid = playerIds[safePlayerIdx] ?? null;
  const row =
    uid && round?.submissions && typeof round.submissions === "object"
      ? /** @type {Record<string, string>} */ (round.submissions)[uid] ?? {}
      : {};

  const displayName =
    uid && Array.isArray(room?.players)
      ? room.players.find((p) => p.userId === uid)?.username ?? `Player ${uid.slice(-4)}`
      : "—";

  const evalRow = useMemo(() => {
    if (!uid || !round) return null;
    const ev = round.evaluation;
    if (!ev || typeof ev !== "object") return null;
    const results = /** @type {{ results?: Array<{ playerId?: string }> }} */ (ev).results;
    if (!Array.isArray(results)) return null;
    return results.find((x) => x.playerId === uid) ?? null;
  }, [round, uid]);

  const goRound = useCallback(
    (delta) => {
      if (sorted.length === 0) return;
      setRoundIdx((i) => {
        const n = (i + delta + sorted.length) % sorted.length;
        return n;
      });
      setPlayerIdx(0);
      setNoteModal(null);
    },
    [sorted.length],
  );

  const goPlayer = useCallback(
    (delta) => {
      if (playerIds.length === 0) return;
      setPlayerIdx((i) => (i + delta + playerIds.length) % playerIds.length);
      setNoteModal(null);
    },
    [playerIds.length],
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPlayer(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPlayer(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        goRound(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        goRound(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPlayer, goRound]);

  useEffect(() => {
    if (!noteModal) return undefined;
    function onEsc(e) {
      if (e.key === "Escape") setNoteModal(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [noteModal]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-[var(--radius-2xl)] bg-white/85 p-10 text-center shadow-[var(--shadow-card)] ring-2 ring-white/80">
        <p className="font-semibold text-ink">No completed rounds in this game.</p>
        <p className="mt-2 text-sm text-ink-muted">If you ended before the first letter, there is nothing to show yet.</p>
      </div>
    );
  }

  const letter = typeof round?.letter === "string" ? round.letter : "—";
  const ri = typeof round?.roundIndex === "number" ? round.roundIndex : roundIdx;
  const evalPending = round?.evaluationStatus === "pending";
  const evalSource = typeof round?.evaluationSource === "string" ? round.evaluationSource : null;

  return (
    <div className="flex flex-col gap-8">
      {noteModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setNoteModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="npat-note-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink/10 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="npat-note-title" className="text-xs font-bold uppercase tracking-widest text-ink-muted">
              Judge note · {noteModal.fieldLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              Answer: <span className="font-bold">{noteModal.answer.trim() ? noteModal.answer : "—"}</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink/90">{noteModal.comment.trim() ? noteModal.comment : EMPTY_NOTE_COPY}</p>
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="secondary" className="text-sm" onClick={() => setNoteModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {leaderboard.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-ink/10 bg-white/90 p-4 shadow-sm"
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

      <div className="flex flex-col gap-4 rounded-xl border border-ink/10 bg-white/95 p-4 shadow-sm ring-1 ring-ink/5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Round</p>
            <p className="mt-0.5 text-lg font-black text-ink">
              Letter <span className="text-accent">{letter}</span>
              <span className="ml-2 text-sm font-bold text-ink-muted">
                ({ri + 1} of {sorted.length})
              </span>
            </p>
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
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-ink/10 pb-px">
          {sorted.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setRoundIdx(i);
                setPlayerIdx(0);
                setNoteModal(null);
              }}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                i === roundIdx
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              R{i + 1}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">View player</span>
            <select
              className="max-w-md rounded-lg border border-ink/10 bg-white py-2 pl-3 pr-8 text-sm font-semibold text-ink shadow-sm outline-none ring-0 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-200"
              value={uid ?? ""}
              onChange={(e) => {
                const next = playerIds.indexOf(e.target.value);
                setPlayerIdx(next >= 0 ? next : 0);
                setNoteModal(null);
              }}
            >
              {playerIds.map((id) => {
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
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="text-sm" onClick={() => goPlayer(-1)}>
              ← Prev
            </Button>
            <Button type="button" variant="secondary" className="text-sm" onClick={() => goPlayer(1)}>
              Next →
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-ink/10">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/[0.035]">
                <th className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Field
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Answer</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Score
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
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
                return (
                  <tr key={key} className="border-b border-ink/[0.06] transition-colors hover:bg-ink/[0.02]">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink">{label}</td>
                    <td className="max-w-[min(280px,40vw)] px-3 py-3 font-medium text-ink">
                      <span className="break-words">{answerText}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                      <span
                        className={`inline-flex min-w-[2.75rem] justify-center rounded-md px-2 py-1 text-xs font-black tabular-nums ${scoreCellClass(sc)}`}
                      >
                        {sc != null ? `${sc}` : "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center align-middle">
                      <button
                        type="button"
                        className="text-xs font-bold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
                        onClick={() =>
                          setNoteModal({
                            fieldKey: key,
                            fieldLabel: label,
                            answer: row[key]?.trim() ? row[key] : "—",
                            comment: rawComment,
                          })
                        }
                      >
                        View note
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-xs text-ink-muted">
          <p>
            <span className="font-bold text-ink">{displayName}</span>
            {evalRow && typeof evalRow.totalScore === "number" ? (
              <span className="ml-2 font-bold text-accent">· Round total: {evalRow.totalScore} pts</span>
            ) : null}
          </p>
          <p className="font-medium">Tip: ← → switch players · ↑ ↓ switch rounds</p>
        </div>
      </div>
    </div>
  );
}
