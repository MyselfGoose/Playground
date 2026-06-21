"use client";

import { motion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";

/**
 * @param {{ text?: string, category?: string, round?: number, totalRounds?: number }} props
 */
export function FibbagePromptCard({ text, category, round, totalRounds }) {
  if (!text) return null;

  const parts = text.split("______");

  return (
    <motion.div
      className="fibbage-card mx-auto w-full max-w-lg p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
    >
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[var(--fibbage-text-muted)]">
        {category && <span className="uppercase tracking-wide">{category}</span>}
        {round != null && totalRounds != null && (
          <span>
            Round {round}/{totalRounds}
          </span>
        )}
      </div>
      <p className="text-lg font-bold leading-relaxed text-[var(--fibbage-text)]">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className="fibbage-prompt-blank" aria-label="blank">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </span>
            )}
          </span>
        ))}
      </p>
    </motion.div>
  );
}

export function FibbagePromptReveal() {
  const { room } = useFibbage();
  const game = room?.game;

  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-6">
      <FibbagePromptCard
        text={game?.prompt?.text}
        category={game?.prompt?.category}
        round={game?.round}
        totalRounds={room?.settings?.roundCount}
      />
      {game?.status === "starting" && (
        <motion.p
          className="text-sm text-[var(--fibbage-text-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Get ready…
        </motion.p>
      )}
    </div>
  );
}
