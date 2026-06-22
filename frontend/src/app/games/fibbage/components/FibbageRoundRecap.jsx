"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "../../../../components/Avatar.jsx";

const ACCENT_CLASSES = {
  gold: "border-[var(--fibbage-gold)]/60 fibbage-recap--gold",
  accent: "border-[var(--fibbage-accent)]/60",
  truth: "border-[var(--fibbage-truth)]/60",
  lie: "border-[var(--fibbage-lie)]/60",
  muted: "border-[var(--fibbage-text-muted)]/30",
};

const CARD_MS = 800;
const TOTAL_MS = 2500;

/**
 * @param {{
 *   highlights: Array<{ id: string, title: string, body: string, userIds: string[], accent: string }>,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   onComplete?: () => void,
 * }} props
 */
export function FibbageRoundRecap({ highlights, players, onComplete }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  const playerMap = new Map(players.map((p) => [p.userId, p]));

  const advance = useCallback(() => {
    setIndex((prev) => {
      if (prev >= highlights.length - 1) {
        setDone(true);
        onComplete?.();
        return prev;
      }
      return prev + 1;
    });
  }, [highlights.length, onComplete]);

  useEffect(() => {
    if (!highlights.length || done) return undefined;
    if (reduce) {
      const frame = requestAnimationFrame(() => {
        setDone(true);
        onComplete?.();
      });
      return () => cancelAnimationFrame(frame);
    }
    const perCard = Math.min(CARD_MS, Math.floor(TOTAL_MS / Math.max(highlights.length, 1)));
    const timer = window.setTimeout(advance, perCard);
    return () => window.clearTimeout(timer);
  }, [index, highlights.length, done, reduce, advance, onComplete]);

  if (!highlights.length) return null;

  if (reduce) {
    return (
      <div className="space-y-3" aria-live="polite" aria-label="Round highlights">
        {highlights.map((h) => (
          <RecapCard key={h.id} highlight={h} playerMap={playerMap} />
        ))}
      </div>
    );
  }

  const current = highlights[Math.min(index, highlights.length - 1)];

  return (
    <div className="min-h-[10rem]" aria-live="polite" aria-label="Round highlights">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.id}-${index}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: index === 0 ? 0.22 : 0.18 }}
        >
          <RecapCard highlight={current} playerMap={playerMap} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * @param {{
 *   highlight: { id: string, title: string, body: string, userIds: string[], accent: string },
 *   playerMap: Map<string, { userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 * }} props
 */
function RecapCard({ highlight, playerMap }) {
  const accentClass = ACCENT_CLASSES[highlight.accent] ?? ACCENT_CLASSES.muted;

  return (
    <div
      className={`fibbage-card border-2 px-6 py-8 text-center shadow-lg ${accentClass}`}
    >
      <p className="fibbage-eyebrow text-[var(--fibbage-gold)]">{highlight.title}</p>
      <p className="mt-3 text-xl font-bold leading-snug text-[var(--fibbage-text)]">
        {highlight.body}
      </p>
      {highlight.userIds.length > 0 ? (
        <div className="mt-5 flex justify-center gap-2">
          {highlight.userIds.map((uid) => {
            const player = playerMap.get(uid);
            if (!player) return null;
            return (
              <Avatar
                key={uid}
                username={player.username}
                avatarUrl={player.avatarUrl}
                avatarEmoji={player.avatarEmoji}
                size="md"
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
