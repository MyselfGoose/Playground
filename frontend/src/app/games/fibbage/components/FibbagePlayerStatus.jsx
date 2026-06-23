"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{
 *   player: { userId: string, username: string, avatarUrl?: string, avatarEmoji?: string, connected?: boolean },
 *   isSubmitted: boolean,
 *   isVoted: boolean,
 * }} props
 */
export function FibbagePlayerStatus({ player, isSubmitted, isVoted }) {
  const reduce = useReducedMotion();
  const statusIcon = isVoted ? "✓" : isSubmitted ? "🔒" : "✏️";
  const statusLabel = isVoted ? "Voted" : isSubmitted ? "Locked in" : "Writing";
  const disconnected = player.connected === false;
  const isActive = !isSubmitted && !isVoted && !disconnected;

  return (
    <motion.div
      className={`flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas-light)] px-3 py-2 ${
        disconnected ? "opacity-40" : ""
      } ${isActive && !reduce ? "fibbage-presence-pulse" : ""}`}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: disconnected ? 0.4 : 1, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      layout={!reduce}
    >
      <Avatar
        username={player.username}
        avatarUrl={player.avatarUrl}
        avatarEmoji={player.avatarEmoji}
        size="sm"
      />
      <span className="flex-1 truncate text-xs font-semibold text-[var(--fibbage-text)]" title={player.username}>
        {player.username}
      </span>
      <span className="shrink-0 text-sm" aria-label={statusLabel} title={statusLabel}>
        {statusIcon}
      </span>
    </motion.div>
  );
}
