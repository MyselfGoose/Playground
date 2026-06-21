"use client";

import { motion } from "framer-motion";
import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{
 *   player: { userId: string, username: string, avatarUrl?: string, avatarEmoji?: string, connected?: boolean },
 *   isSubmitted: boolean,
 *   isVoted: boolean,
 * }} props
 */
export function FibbagePlayerStatus({ player, isSubmitted, isVoted }) {
  const statusIcon = isVoted ? "✓" : isSubmitted ? "🔒" : "✏️";
  const statusLabel = isVoted ? "Voted" : isSubmitted ? "Locked in" : "Writing";
  const opacity = player.connected === false ? "opacity-40" : "";

  return (
    <motion.div
      className={`flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas-light)] px-3 py-2 ${opacity}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: player.connected === false ? 0.4 : 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Avatar
        username={player.username}
        avatarUrl={player.avatarUrl}
        avatarEmoji={player.avatarEmoji}
        size="sm"
      />
      <span className="flex-1 truncate text-xs font-semibold text-[var(--fibbage-text)]">
        {player.username}
      </span>
      <span
        className="shrink-0 text-sm"
        aria-label={statusLabel}
        title={statusLabel}
      >
        {statusIcon}
      </span>
    </motion.div>
  );
}
