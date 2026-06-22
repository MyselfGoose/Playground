"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import { cardStagger } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const STAT_ICONS = {
  biggest_liar: "🎭",
  best_detective: "🔍",
  solo_artist: "🐺",
  most_gullible: "😅",
  prolific_writer: "✍️",
  highest_round: "⚡",
  closest_game: "🎯",
};

/**
 * @param {{
 *   summary?: { stats: Array<{ id: string, label: string, userId: string | null, value: number, displayValue: string }>, margin: number } | null,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number }>,
 *   viewerSessionStat?: { foolsEarned?: number, timesFooled?: number } | null,
 *   winnerUserId?: string | null,
 * }} props
 */
export function FibbageGameStats({
  summary,
  players,
  viewerSessionStat,
  winnerUserId,
}) {
  const reduce = useReducedMotion();

  if (!summary?.stats?.length) return null;

  const playerMap = new Map(players.map((p) => [p.userId, p]));
  const stats = summary.stats;

  return (
    <motion.section
      className="space-y-6"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : 0.9, duration: 0.4 }}
      aria-label="Game statistics"
    >
      <h2 className="text-center text-lg font-black text-[var(--fibbage-text)]">Game Stats</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => {
          const player = stat.userId ? playerMap.get(stat.userId) : null;
          const isWinnerCard = stat.userId && stat.userId === winnerUserId;
          const icon = STAT_ICONS[stat.id] ?? "🏆";

          return (
            <motion.div
              key={stat.id}
              className="fibbage-card relative flex flex-col items-center gap-2 p-4 text-center"
              {...cardStagger(index, reduce)}
            >
              {isWinnerCard ? (
                <Crown
                  className="absolute right-2 top-2 h-4 w-4 text-[var(--fibbage-gold)]"
                  aria-hidden
                />
              ) : null}
              <span className="text-2xl" aria-hidden>
                {icon}
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-gold)]">
                {stat.label}
              </p>
              {player ? (
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size="sm"
                />
              ) : null}
              <p className="text-sm font-semibold text-[var(--fibbage-text)]">
                {stat.userId && player ? player.username : stat.id === "closest_game" ? null : null}
              </p>
              <p className="fibbage-micro text-[var(--fibbage-text-muted)]">{stat.displayValue}</p>
            </motion.div>
          );
        })}
      </div>

      {viewerSessionStat ? (
        <PersonalCallout stat={viewerSessionStat} />
      ) : null}
    </motion.section>
  );
}

/**
 * @param {{ stat: { foolsEarned?: number, timesFooled?: number } }} props
 */
function PersonalCallout({ stat }) {
  const fooled = stat.foolsEarned ?? 0;
  const gullible = stat.timesFooled ?? 0;

  let line = null;
  if (fooled > 0) {
    line = `You fooled ${fooled} player${fooled === 1 ? "" : "s"} this game`;
  } else if (gullible > 0) {
    line = `You were fooled ${gullible} time${gullible === 1 ? "" : "s"} — ouch`;
  }

  if (!line) return null;

  return (
    <p className="text-center text-sm font-semibold text-[var(--fibbage-accent)]" aria-live="polite">
      {line}
    </p>
  );
}
