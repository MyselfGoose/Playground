"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { getGameHref } from "../../lib/games.js";
import { Button } from "../Button.jsx";

const accentColors = {
  lavender: "from-pastel-lavender to-pastel-sky",
  mint: "from-pastel-mint to-accent-mint",
  peach: "from-pastel-peach to-primary",
  sky: "from-pastel-sky to-accent-sky",
  butter: "from-pastel-butter to-accent-lemon",
};

/**
 * @typedef {'grid' | 'hero'} GameCatalogCardVariant
 */

/**
 * @param {{
 *   game: import('../../lib/games.js').Game;
 *   index?: number;
 *   variant?: GameCatalogCardVariant;
 *   playable?: boolean;
 *   href?: string;
 * }} props
 */
export function GameCatalogCard({
  game,
  index = 0,
  variant = "grid",
  playable = true,
  href,
}) {
  const reduce = useReducedMotion();
  const link = href ?? (playable ? getGameHref(game.id) : "#");
  const gradient = accentColors[game.accent] ?? accentColors.lavender;
  const isHero = variant === "hero";

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : index * 0.06 }}
      whileHover={reduce ? undefined : { y: -4 }}
      className={`group relative overflow-hidden rounded-[var(--radius-2xl)] bg-gradient-to-br ${gradient} shadow-[var(--shadow-md)] ring-2 ring-foreground/10`}
    >
      <Link
        href={link}
        className={`flex items-center gap-4 p-4 transition-all hover:ring-foreground/20 hover:shadow-[var(--shadow-play)] md:hidden ${
          !playable ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <span className="text-3xl" aria-hidden>
          {game.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold text-foreground">{game.title}</h3>
          <p className="line-clamp-2 text-sm text-foreground/75">{game.description}</p>
        </div>
        {playable ? (
          <span className="shrink-0 rounded-full bg-background/80 px-3 py-1.5 text-xs font-extrabold text-foreground">
            Play
          </span>
        ) : (
          <span className="shrink-0 text-xs font-bold text-muted">Soon</span>
        )}
      </Link>

      <div
        className={`relative hidden h-full flex-col p-6 sm:p-8 md:flex ${isHero ? "sm:p-10" : ""}`}
      >
        <div className="relative z-[1] flex items-start justify-between gap-3">
          <span className="text-5xl sm:text-6xl" aria-hidden>
            {game.emoji}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest ring-2 ring-foreground/15 ${
              playable ? "bg-background/80 text-foreground" : "bg-background/60 text-muted"
            }`}
          >
            {playable ? "Live" : "Soon"}
          </span>
        </div>

        <div className="relative z-[1] mt-4 flex flex-1 flex-col">
          <h3
            className={`font-black tracking-tight text-foreground ${isHero ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}
          >
            {game.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/75 sm:text-base">
            {game.description}
          </p>
          <div className="mt-5">
            {playable ? (
              <Link href={link} className="block">
                <Button
                  variant="secondary"
                  size="touch"
                  className="w-full bg-background/80 font-extrabold hover:bg-background"
                >
                  Play Now
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" className="w-full opacity-60" disabled>
                Coming Soon
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
