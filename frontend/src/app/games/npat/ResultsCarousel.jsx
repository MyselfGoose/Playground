"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../../../components/Button.jsx";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "place", label: "Place" },
  { key: "animal", label: "Animal" },
  { key: "thing", label: "Thing" },
];

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

  const round = sorted[roundIdx] ?? null;

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

  const goRound = useCallback(
    (delta) => {
      if (sorted.length === 0) return;
      setRoundIdx((i) => {
        const n = (i + delta + sorted.length) % sorted.length;
        return n;
      });
      setPlayerIdx(0);
    },
    [sorted.length],
  );

  const goPlayer = useCallback(
    (delta) => {
      if (playerIds.length === 0) return;
      setPlayerIdx((i) => (i + delta + playerIds.length) % playerIds.length);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 ring-2 ring-white/90">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">Round</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" className="min-w-[2.5rem] px-2" onClick={() => goRound(-1)}>
            ←
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-extrabold text-ink">
            {ri + 1} / {sorted.length}
          </span>
          <Button type="button" variant="secondary" className="min-w-[2.5rem] px-2" onClick={() => goRound(1)}>
            →
          </Button>
        </div>
        <span className="text-2xl font-black text-accent">{letter}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${ri}-${uid}`}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-accent/15 to-accent-2/25 p-8 shadow-[var(--shadow-soft)] ring-2 ring-white/90"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Answers for letter</p>
              <p className="text-5xl font-black text-ink">{letter}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Player</p>
              <p className="text-2xl font-extrabold text-ink">{displayName}</p>
              <p className="mt-1 text-xs font-bold text-ink-muted">
                {safePlayerIdx + 1} of {playerIds.length}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-ink/10"
              >
                <dt className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">{label}</dt>
                <dd className="mt-1 text-lg font-bold text-ink">{row[key]?.trim() ? row[key] : "—"}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="secondary" onClick={() => goPlayer(-1)}>
              Previous player
            </Button>
            <Button type="button" variant="secondary" onClick={() => goPlayer(1)}>
              Next player
            </Button>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-ink-muted">
            Tip: use ← → for players, ↑ ↓ for rounds.
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap justify-center gap-1.5">
        {sorted.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to round ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-transform ${
              i === roundIdx ? "scale-125 bg-accent" : "bg-ink/20 hover:bg-ink/40"
            }`}
            onClick={() => {
              setRoundIdx(i);
              setPlayerIdx(0);
            }}
          />
        ))}
      </div>
    </div>
  );
}
