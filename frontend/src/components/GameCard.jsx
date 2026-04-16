"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./Button.jsx";

const accentStyles = {
  lavender: "from-lavender/90 to-lavender/40 ring-white/70",
  mint: "from-mint/90 to-mint/40 ring-white/70",
  peach: "from-peach/90 to-peach/40 ring-white/70",
  sky: "from-sky/90 to-sky/40 ring-white/70",
  butter: "from-butter/90 to-butter/40 ring-white/70",
};

const tilts = [
  "rotate-[-0.8deg]",
  "rotate-[0.6deg]",
  "rotate-[0.4deg]",
  "rotate-[-0.5deg]",
  "rotate-[0.7deg]",
];

/** @param {{ game: import('../lib/games.js').Game; index: number }} props */
export function GameCard({ game, index }) {
  const reduce = useReducedMotion();
  const tilt = tilts[index % tilts.length];
  const accent = accentStyles[game.accent] ?? accentStyles.lavender;

  return (
    <motion.article
      layout
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduce ? 0 : index * 0.06,
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduce
          ? undefined
          : { y: -8, rotate: 0, transition: { type: "spring", stiffness: 360, damping: 18 } }
      }
      className={`relative flex flex-col gap-4 rounded-[var(--radius-2xl)] bg-gradient-to-br p-6 shadow-[var(--shadow-card)] ring-2 ${accent} ${tilt}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="select-none text-4xl drop-shadow-sm sm:text-5xl"
          aria-hidden
        >
          {game.emoji}
        </span>
        <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-muted ring-1 ring-ink/5">
          Soon
        </span>
      </div>
      <div>
        <h3 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {game.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-base">
          {game.description}
        </p>
      </div>
      <div className="mt-auto pt-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={(e) => e.preventDefault()}
        >
          Play
        </Button>
      </div>
    </motion.article>
  );
}
