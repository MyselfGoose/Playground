"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { recapSlide } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const ACCENT_CLASSES = {
  gold: "border-[var(--fibbage-gold)]/60 fibbage-recap--gold",
  accent: "border-[var(--fibbage-accent)]/60",
  truth: "border-[var(--fibbage-truth)]/60",
  lie: "border-[var(--fibbage-lie)]/60",
  muted: "border-[var(--fibbage-text-muted)]/30",
};

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
  const [direction, setDirection] = useState(/** @type {'left' | 'right'} */ ("right"));

  const playerMap = new Map(players.map((p) => [p.userId, p]));
  const highlightsKey = highlights.map((h) => h.id).join(",");
  const total = highlights.length;
  const canGoPrev = index > 0;
  const canGoNext = index < total - 1;

  useEffect(() => {
    setIndex(0);
    setDirection("right");
  }, [highlightsKey]);

  useEffect(() => {
    onComplete?.();
  }, [onComplete]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    setDirection("left");
    setIndex((i) => i - 1);
  }, [canGoPrev]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    setDirection("right");
    setIndex((i) => i + 1);
  }, [canGoNext]);

  if (!highlights.length) return null;

  const current = highlights[Math.min(index, total - 1)];

  if (total === 1) {
    return (
      <div className="min-h-[8rem]" aria-live="polite" aria-label="Round highlights">
        <RecapCard highlight={current} playerMap={playerMap} />
      </div>
    );
  }

  return (
    <div className="min-h-[8rem]" aria-live="polite" aria-label="Round highlights">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas)] text-[var(--fibbage-text)] transition-colors hover:border-[var(--fibbage-accent)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous highlight"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${current.id}-${index}`}
              custom={direction}
              {...recapSlide(reduce, direction)}
            >
              <RecapCard highlight={current} playerMap={playerMap} />
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas)] text-[var(--fibbage-text)] transition-colors hover:border-[var(--fibbage-accent)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next highlight"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Highlight navigation">
        {highlights.map((h, i) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Highlight ${i + 1} of ${total}`}
            onClick={() => {
              setDirection(i > index ? "right" : "left");
              setIndex(i);
            }}
            className={`h-2 rounded-full transition-all ${
              i === index
                ? "w-6 bg-[var(--fibbage-accent)]"
                : "w-2 bg-[var(--fibbage-text-muted)]/40 hover:bg-[var(--fibbage-text-muted)]/70"
            }`}
          />
        ))}
      </div>

      <p className="mt-2 text-center fibbage-micro">
        {index + 1} of {total}
      </p>
    </div>
  );
}

/**
 * @param {{
 *   highlight: { id: string, title: string, body: string, userIds: string[], accent: string },
 *   playerMap: Map<string, { userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   compact?: boolean,
 * }} props
 */
function RecapCard({ highlight, playerMap, compact = false }) {
  const accentClass = ACCENT_CLASSES[highlight.accent] ?? ACCENT_CLASSES.muted;

  return (
    <div
      className={`fibbage-card border-2 text-center shadow-lg ${accentClass} ${
        compact ? "px-4 py-4" : "px-6 py-8"
      }`}
    >
      <p className="fibbage-eyebrow text-[var(--fibbage-gold)]">{highlight.title}</p>
      <p
        className={`mt-2 font-bold leading-snug text-[var(--fibbage-text)] ${
          compact ? "text-base" : "text-xl"
        }`}
      >
        {highlight.body}
      </p>
      {highlight.userIds.length > 0 ? (
        <div className={`flex justify-center gap-2 ${compact ? "mt-3" : "mt-5"}`}>
          {highlight.userIds.map((uid) => {
            const player = playerMap.get(uid);
            if (!player) return null;
            return (
              <Avatar
                key={uid}
                username={player.username}
                avatarUrl={player.avatarUrl}
                avatarEmoji={player.avatarEmoji}
                size={compact ? "sm" : "md"}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
