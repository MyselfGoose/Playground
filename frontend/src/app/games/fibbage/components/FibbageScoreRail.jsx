"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../../../components/Avatar.jsx";
import { useAdaptiveLayout } from "../../../../lib/adaptive/useAdaptiveLayout.js";

/**
 * Animated count-up for score rail.
 * @param {{ value: number, reduce: boolean, className?: string }} props
 */
function RailScore({ value, reduce, className = "" }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (reduce || prevRef.current === value) {
      prevRef.current = value;
      setDisplay(value);
      return undefined;
    }
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return undefined;

    const duration = 450;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  );
}

/**
 * @param {{ players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number }> }} props
 */
export function FibbageScoreRail({ players }) {
  const reduce = useReducedMotion();
  const { isTabletOrAbove } = useAdaptiveLayout();
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const leaderId = sorted[0]?.userId ?? null;

  return (
    <aside
      className={`fibbage-rank-strip ${isTabletOrAbove ? "fibbage-rank-strip--side" : ""}`}
    >
      <p className="mb-2 fibbage-micro uppercase tracking-wide">Leaderboard</p>
      <div
        className={
          isTabletOrAbove
            ? "flex flex-col gap-2 overflow-y-auto max-h-[min(70dvh,24rem)]"
            : "flex gap-2 overflow-x-auto pb-1"
        }
      >
        {sorted.map((player, index) => (
          <ScoreRailItem
            key={player.userId}
            player={player}
            rank={index + 1}
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
 *   rank: number,
 *   isLeader: boolean,
 *   index: number,
 *   reduce: boolean,
 * }} props
 */
function ScoreRailItem({ player, rank, isLeader, index, reduce }) {
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
      className={`fibbage-rank-item ${isLeader ? "fibbage-rank-item--leader" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22 }}
    >
      <span className="fibbage-rank-item__position">
        {isLeader ? "👑" : `#${rank}`}
      </span>
      <Avatar
        username={player.username}
        avatarUrl={player.avatarUrl}
        avatarEmoji={player.avatarEmoji}
        size="sm"
      />
      <span
        className="max-w-[8rem] truncate text-xs font-semibold text-[var(--fibbage-text)] sm:max-w-[10rem]"
        title={player.username}
      >
        {player.username}
      </span>
      <span
        ref={flashRef}
        className="text-sm font-black text-[var(--fibbage-gold)]"
        aria-live="polite"
      >
        <RailScore value={score} reduce={reduce} />
      </span>
    </motion.div>
  );
}
