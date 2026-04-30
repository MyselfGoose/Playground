"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./Button.jsx";

const accentColors = {
  lavender: { bg: "from-pastel-lavender to-pastel-sky", accent: "accent-purple", badge: "bg-accent-purple" },
  mint: { bg: "from-pastel-mint to-accent-mint", accent: "accent-mint", badge: "bg-accent-mint" },
  peach: { bg: "from-pastel-peach to-primary", accent: "accent-pink", badge: "bg-primary" },
  sky: { bg: "from-pastel-sky to-accent-sky", accent: "accent-sky", badge: "bg-accent-sky" },
  butter: { bg: "from-pastel-butter to-accent-lemon", accent: "accent-lemon", badge: "bg-accent-lemon" },
};

const tilts = [
  "rotate-[-1.2deg]",
  "rotate-[0.8deg]",
  "rotate-[0.5deg]",
  "rotate-[-0.6deg]",
  "rotate-[1deg]",
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

/** @param {{ game: import('../lib/games.js').Game; index: number }} props */
export function GameCard({ game, index }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const tilt = tilts[index % tilts.length];
  const colors = accentColors[game.accent] ?? accentColors.lavender;
  const isNpat = game.id === "name-place-animal-thing";
  const isTypingRace = game.id === "typing-race";
  const isTaboo = game.id === "taboo";
  const isPlayable = isNpat || isTypingRace || isTaboo;

  return (
    <motion.article
      layout
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduce ? 0 : index * 0.08,
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={
        reduce
          ? undefined
          : { y: -12, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }
      }
      className={`group relative flex flex-col gap-5 rounded-[var(--radius-2xl)] bg-gradient-to-br ${colors.bg} p-6 sm:p-8 shadow-[var(--shadow-md)] ring-2 ring-white/40 overflow-hidden transition-all ${tilt}`}
    >
      {/* Background accent blob */}
      <motion.div
        aria-hidden
        className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full opacity-20 blur-xl"
        initial={{ scale: 0.8 }}
        whileHover={reduce ? undefined : { scale: 1.1 }}
        style={{
          background: `var(--${colors.accent})`,
        }}
      />

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <span
          className="select-none text-5xl drop-shadow-sm sm:text-6xl group-hover:scale-110 transition-transform"
          aria-hidden
        >
          {game.emoji}
        </span>
        <motion.span
          whileHover={reduce ? undefined : { scale: 1.1 }}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest ring-2 ring-white/50 ${
            isPlayable
              ? `${colors.badge} text-white shadow-[var(--shadow-play)]`
              : "bg-white/60 text-foreground"
          }`}
        >
          {isPlayable ? "▶ Live" : "Soon"}
        </motion.span>
      </div>

      <div className="relative z-[1]">
        <h3 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl leading-tight">
          {game.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-foreground/75 sm:text-base">
          {game.description}
        </p>
      </div>

      <div className="relative z-[1] mt-auto pt-3">
        {isPlayable ? (
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.02 }}
            whileTap={reduce ? undefined : { scale: 0.98 }}
          >
            <Button
              type="button"
              variant="secondary"
              className="w-full bg-white/80 hover:bg-white font-extrabold"
              onClick={() => {
                if (isNpat) router.push("/games/npat");
                else if (isTypingRace) router.push("/games/typing-race");
                else if (isTaboo) router.push("/games/taboo");
              }}
            >
              Play Now
            </Button>
          </motion.div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full bg-white/60 opacity-60 cursor-not-allowed hover:bg-white/60"
            disabled
          >
            Coming Soon
          </Button>
        )}
      </div>
    </motion.article>
  );
}
