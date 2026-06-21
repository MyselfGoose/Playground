"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { Avatar } from "../../../../components/Avatar.jsx";

export function FibbageScoreboard() {
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const roundScores = game?.roundScores ?? {};

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const topScorer = sorted[0]?.userId;
  const maxRoundScore = Math.max(0, ...Object.values(roundScores));
  const topRoundScorer = Object.entries(roundScores).find(([, v]) => v === maxRoundScore)?.[0];

  return (
    <motion.div
      className="mx-auto w-full max-w-lg space-y-4 py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-center text-lg font-black uppercase tracking-wide text-[var(--fibbage-accent-glow)]">
        Scoreboard
      </h2>

      <div className="space-y-2">
        {sorted.map((player, i) => {
          const isTopRound = player.userId === topRoundScorer && maxRoundScore > 0;
          const roundDelta = roundScores[player.userId] ?? 0;

          return (
            <motion.div
              key={player.userId}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                isTopRound
                  ? "bg-[var(--fibbage-gold)]/10 border border-[var(--fibbage-gold)]/30"
                  : "bg-[var(--fibbage-canvas-light)]"
              }`}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <span className="w-6 text-center text-sm font-black text-[var(--fibbage-text-muted)]">
                {i + 1}
              </span>
              <Avatar
                username={player.username}
                avatarUrl={player.avatarUrl}
                avatarEmoji={player.avatarEmoji}
                size="sm"
              />
              <span className="flex-1 text-sm font-bold text-[var(--fibbage-text)]">
                {player.username}
              </span>
              {roundDelta > 0 && (
                <motion.span
                  className="text-xs font-bold text-[var(--fibbage-gold)]"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  +{roundDelta}
                </motion.span>
              )}
              <AnimatedScore score={player.score ?? 0} />
            </motion.div>
          );
        })}
      </div>

      {game?.status === "between_rounds" && (
        <motion.p
          className="text-center text-sm text-[var(--fibbage-text-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Next round starting soon…
        </motion.p>
      )}
    </motion.div>
  );
}

function AnimatedScore({ score }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = score;
    if (from === to) {
      setDisplayed(to);
      return;
    }

    const duration = 800;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
    prevRef.current = to;
  }, [score]);

  return (
    <span className="min-w-[3rem] text-right text-base font-black tabular-nums text-[var(--fibbage-text)]">
      {displayed}
    </span>
  );
}
