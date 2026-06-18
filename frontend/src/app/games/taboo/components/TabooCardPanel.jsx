"use client";

import { AnimatePresence, motion } from "framer-motion";
import { motionPresets } from "../../../../lib/taboo/motion.js";
import { TabooCard } from "../ui/index.js";

/**
 * @param {{
 *   game: object,
 *   reduceMotion: boolean,
 * }} props
 */
export function TabooCardPanel({ game, reduceMotion }) {
  const cardVisible = Boolean(game?.cardVisibleToViewer && game?.currentCard);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={game?.currentCard?.id || "hidden"}
        {...(reduceMotion ? {} : motionPresets.cardSwap)}
        className="mb-4"
        aria-label="Current card"
      >
        <TabooCard level={2} glow="accent" className="flex min-h-[280px] flex-col p-5 sm:p-6">
          {cardVisible ? (
            <>
              <div className="mb-4 flex justify-center">
                <span className="rounded-full taboo-surface-inset px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--taboo-text-secondary)]">
                  {game.currentCard.category || "—"}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <h2 className="text-center font-display text-3xl font-bold leading-tight text-[var(--taboo-text)] sm:text-4xl">
                  {game.currentCard.question || "Waiting"}
                </h2>
              </div>
              <div className="mt-4 pt-4">
                <div className="taboo-divider mb-4" />
                <p className="mb-3 text-center taboo-text-micro text-taboo-danger-text">
                  Forbidden words
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(game.currentCard.taboo || []).map((word, index) => (
                    <motion.span
                      key={word}
                      {...(reduceMotion ? {} : motionPresets.tabooWord(index))}
                      className="taboo-forbidden-chip"
                    >
                      {word}
                    </motion.span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-12">
              <p className="mb-2 text-lg font-semibold text-[var(--taboo-text)]">Hidden card</p>
              <p className="text-sm text-[var(--taboo-text-secondary)]">Guess the word from your clue giver.</p>
            </div>
          )}
        </TabooCard>
      </motion.div>
    </AnimatePresence>
  );
}
