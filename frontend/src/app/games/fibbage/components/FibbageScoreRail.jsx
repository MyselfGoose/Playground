"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{ players: Array<{ userId: string, username: string, avatarUrl?: string, avatarEmoji?: string, score?: number }> }} props
 */
export function FibbageScoreRail({ players }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (players.length === 0) return null;

  return (
    <>
      {/* Desktop: horizontal rail */}
      <div className="hidden border-t border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)]/50 px-4 py-2 backdrop-blur-sm sm:block">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-4">
          {sorted.map((player) => (
            <div key={player.userId} className="flex items-center gap-1.5">
              <Avatar
                username={player.username}
                avatarUrl={player.avatarUrl}
                avatarEmoji={player.avatarEmoji}
                size="sm"
              />
              <span className="text-xs font-semibold text-[var(--fibbage-text)]">
                {player.username}
              </span>
              <span className="text-xs font-black tabular-nums text-[var(--fibbage-accent)]">
                {player.score ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: collapsible */}
      <div className="sm:hidden">
        <button
          className="flex w-full items-center justify-center gap-2 border-t border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)]/50 px-4 py-2 backdrop-blur-sm"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label="Toggle score rail"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
            Scores
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-[var(--fibbage-text-muted)]"
            aria-hidden
          >
            ▾
          </motion.span>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              className="space-y-1 border-t border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)]/80 px-4 py-2 backdrop-blur-sm"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {sorted.map((player) => (
                <div key={player.userId} className="flex items-center gap-2 py-0.5">
                  <Avatar
                    username={player.username}
                    avatarUrl={player.avatarUrl}
                    avatarEmoji={player.avatarEmoji}
                    size="sm"
                  />
                  <span className="flex-1 text-xs font-semibold text-[var(--fibbage-text)]">
                    {player.username}
                  </span>
                  <span className="text-xs font-black tabular-nums text-[var(--fibbage-accent)]">
                    {player.score ?? 0}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
