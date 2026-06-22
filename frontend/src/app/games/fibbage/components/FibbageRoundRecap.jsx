"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { recapCard } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const ACCENT_CLASSES = {
  gold: "border-[var(--fibbage-gold)]/60 fibbage-recap--gold",
  accent: "border-[var(--fibbage-accent)]/60",
  truth: "border-[var(--fibbage-truth)]/60",
  lie: "border-[var(--fibbage-lie)]/60",
  muted: "border-[var(--fibbage-text-muted)]/30",
};

const RECAP_CARD_DWELL_MS = 1400;
const RECAP_LAST_CARD_PAUSE_MS = 400;

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
  const onCompleteRef = useRef(onComplete);
  const highlightsKeyRef = useRef("");

  onCompleteRef.current = onComplete;

  const playerMap = new Map(players.map((p) => [p.userId, p]));

  const finish = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  const highlightsKey = highlights.map((h) => h.id).join(",");

  useEffect(() => {
    if (highlightsKey !== highlightsKeyRef.current) {
      highlightsKeyRef.current = highlightsKey;
      setIndex(0);
    }
  }, [highlightsKey]);

  useEffect(() => {
    if (!highlights.length) return undefined;

    if (reduce) {
      const frame = requestAnimationFrame(() => finish());
      return () => cancelAnimationFrame(frame);
    }

    const isLast = index >= highlights.length - 1;
    const dwell = isLast ? RECAP_CARD_DWELL_MS + RECAP_LAST_CARD_PAUSE_MS : RECAP_CARD_DWELL_MS;

    const timer = window.setTimeout(() => {
      if (isLast) {
        finish();
        return;
      }
      setIndex((prev) => prev + 1);
    }, dwell);

    return () => window.clearTimeout(timer);
  }, [index, highlights.length, reduce, finish]);

  if (!highlights.length) return null;

  if (reduce) {
    return (
      <div className="min-h-[10rem] space-y-3" aria-live="polite" aria-label="Round highlights">
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
          {...recapCard(reduce, index === 0)}
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
