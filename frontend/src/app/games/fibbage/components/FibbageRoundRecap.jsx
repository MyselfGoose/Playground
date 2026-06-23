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

const RECAP_CARD_DWELL_MS = 1200;
const RECAP_LAST_CARD_PAUSE_MS = 300;
const RECAP_STACK_DWELL_MS = 2200;

/**
 * @param {{
 *   highlights: Array<{ id: string, title: string, body: string, userIds: string[], accent: string }>,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   onComplete?: () => void,
 *   stacked?: boolean,
 * }} props
 */
export function FibbageRoundRecap({ highlights, players, onComplete, stacked = false }) {
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

    if (reduce || stacked) {
      const dwell = stacked ? RECAP_STACK_DWELL_MS : 0;
      if (dwell === 0) {
        const frame = requestAnimationFrame(() => finish());
        return () => cancelAnimationFrame(frame);
      }
      const timer = window.setTimeout(() => finish(), dwell);
      return () => window.clearTimeout(timer);
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
  }, [index, highlights.length, reduce, stacked, finish]);

  if (!highlights.length) return null;

  if (reduce || stacked) {
    return (
      <div
        className="fibbage-recap-stack space-y-3"
        aria-live="polite"
        aria-label="Round highlights"
      >
        {highlights.map((h, i) => (
          <motion.div
            key={h.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.22 }}
          >
            <RecapCard highlight={h} playerMap={playerMap} compact={stacked && highlights.length > 1} />
          </motion.div>
        ))}
      </div>
    );
  }

  const current = highlights[Math.min(index, highlights.length - 1)];

  return (
    <div className="min-h-[8rem]" aria-live="polite" aria-label="Round highlights">
      <AnimatePresence mode="wait">
        <motion.div key={`${current.id}-${index}`} {...recapCard(reduce, index === 0)}>
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
