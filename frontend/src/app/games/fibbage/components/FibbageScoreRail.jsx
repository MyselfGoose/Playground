"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{ players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number }> }} props
 */
export function FibbageScoreRail({ players }) {
  const reduce = useReducedMotion();
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const leaderId = sorted[0]?.userId ?? null;

  return (
    <aside className="border-t border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)] px-4 py-3">
      <p className="mb-2 fibbage-micro uppercase tracking-wide">Scores</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {sorted.map((player, index) => (
          <ScoreRailItem
            key={player.userId}
            player={player}
            isLeader={player.userId === leaderId && (player.score ?? 0) > 0}
            index={index}
            reduce={reduce}
          />
        ))}
      </div>
    </aside>
  );
}

/**
 * @param {{
 *   player: { userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number },
 *   isLeader: boolean,
 *   index: number,
 *   reduce: boolean,
 * }} props
 */
function ScoreRailItem({ player, isLeader, index, reduce }) {
  const score = player.score ?? 0;
  const prevScoreRef = useRef(score);
  const flashRef = useRef(/** @type {HTMLSpanElement | null} */ (null));

  useEffect(() => {
    if (reduce || score <= prevScoreRef.current) {
      prevScoreRef.current = score;
      return;
    }
    const el = flashRef.current;
    if (!el) return;
    el.classList.remove("fibbage-score-flash");
    void el.offsetWidth;
    el.classList.add("fibbage-score-flash");
    prevScoreRef.current = score;
  }, [score, reduce]);

  return (
    <motion.div
      className={`flex min-w-[5.5rem] flex-col items-center gap-1 rounded-lg px-3 py-2 ${
        isLeader
          ? "border border-[var(--fibbage-gold)]/40 bg-[var(--fibbage-canvas)]"
          : "bg-[var(--fibbage-canvas)]"
      }`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22 }}
      layout={!reduce}
    >
      <Avatar
        username={player.username}
        avatarUrl={player.avatarUrl}
        avatarEmoji={player.avatarEmoji}
        size="sm"
      />
      <span className="max-w-[5rem] truncate text-xs font-semibold text-[var(--fibbage-text)]">
        {player.username}
      </span>
      <span
        ref={flashRef}
        className="text-sm font-black text-[var(--fibbage-gold)]"
        aria-live="polite"
      >
        {score}
      </span>
    </motion.div>
  );
}
