"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { hostLabel } from "../../../../lib/fibbage/motion.js";

const STATUS_LABELS = {
  starting: "Round starting",
  prompt_reveal: "Read the prompt",
  writing: "Writing phase",
  voting: "Voting phase",
  revealing: "Results",
  scoring: "Scoring",
  between_rounds: "Between rounds",
};

/**
 * @param {{ status?: string }} props
 */
export function FibbageHost({ status }) {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const label = status ? (STATUS_LABELS[status] ?? "Fibbage") : "Fibbage";
  const category = game?.prompt?.category;
  const round = game?.round;
  const roundCount = room?.settings?.roundCount ?? 5;
  const multiplier = game?.roundMultiplier ?? 1;
  const isBlitz = room?.settings?.presetId === "blitz";
  const motionProps = hostLabel(reduce);

  return (
    <header className="px-4 pt-4">
      <div className="fibbage-host-strip flex flex-wrap items-center justify-between gap-2">
        <AnimatePresence mode="wait">
          <motion.span key={status ?? "idle"} {...motionProps}>
            {label}
          </motion.span>
        </AnimatePresence>
        <div className="flex flex-wrap items-center gap-3 text-xs normal-case tracking-normal">
          {typeof round === "number" ? (
            <span className="flex items-center gap-2">
              Round {round}/{roundCount}
              {isBlitz ? (
                <span className="rounded-full bg-[var(--fibbage-cta)]/20 px-2 py-0.5 font-bold text-[var(--fibbage-cta)]">
                  ⚡ Blitz
                </span>
              ) : null}
            </span>
          ) : null}
          {category ? <span className="capitalize">{category}</span> : null}
          {multiplier > 1 ? (
            <span className="text-[var(--fibbage-gold)]">{multiplier}x points</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
