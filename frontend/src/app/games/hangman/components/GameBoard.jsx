"use client";

import { motion } from "framer-motion";
import { HangmanFigure } from "./HangmanFigure.jsx";
import { HANGMAN_MAX_WRONG } from "../constants.js";

/**
 * @param {{
 *   maskedWord: string,
 *   wrongCount: number,
 *   phaseLabel: string,
 *   roundNumber: number,
 * }} props
 */
export function GameBoard({ maskedWord, wrongCount, phaseLabel, roundNumber }) {
  const remaining = Math.max(0, HANGMAN_MAX_WRONG - wrongCount);

  return (
    <motion.section
      layout
      className="rounded-3xl border border-foreground/10 bg-background/95 p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-foreground/55">
            Round {roundNumber} · {phaseLabel}
          </p>
          <p className="mt-3 font-mono text-2xl font-black tracking-[0.15em] text-foreground sm:text-4xl">
            {maskedWord || "—"}
          </p>
          <p className="mt-2 text-sm font-bold text-foreground/60">
            Strikes: <span className="text-error">{wrongCount}</span> / {HANGMAN_MAX_WRONG}
            <span className="mx-2 text-foreground/30">·</span>
            {remaining} left
          </p>
        </div>
        <HangmanFigure wrongCount={wrongCount} className="h-36 w-28 shrink-0 text-foreground sm:h-44 sm:w-36" />
      </div>
    </motion.section>
  );
}
