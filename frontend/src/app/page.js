"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "../components/Button.jsx";
import { GameCatalogCard } from "../components/adaptive/GameCatalogCard.jsx";
import { getPlayableGames } from "../lib/games.js";
export default function HomePage() {
  const router = useRouter();
  const playableGames = getPlayableGames();

  return (
    <motion.div
      className="flex min-h-dvh w-full flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* HERO SECTION - BOLD AND LARGE */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-20 sm:px-6 sm:py-32">
        <motion.div
          className="relative z-10 text-center max-w-3xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Emoji watermark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-6xl sm:text-8xl mb-6 inline-block"
          >
            🎮
          </motion.div>

          {/* Main tagline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-display font-black tracking-tighter leading-tight text-foreground mb-4"
          >
            The <span className="bg-gradient-to-r from-primary via-accent-pink to-accent-purple bg-clip-text text-transparent">Playground</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg sm:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            Multiplayer games designed for fun, laughter, and killer competition
          </motion.p>

          {/* CTA Button - Single large button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4 justify-center flex-wrap"
          >
            <Button
              variant="primary"
              size="touch"
              className="rounded-full px-10 text-xl font-extrabold shadow-[var(--shadow-play)]"
              onClick={() => router.push("/games")}
            >
              Play Now
            </Button>
            <Button
              variant="secondary"
              size="touch"
              className="rounded-full px-10 text-xl font-extrabold"
              onClick={() => router.push("/leaderboard")}
            >
              View Rankings
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* GAMES SECTION - SHOWCASE */}
      <section className="bg-gradient-to-b from-transparent via-muted-bright/10 to-background px-4 py-20 sm:px-6 sm:py-32">
        <motion.div
          className="mx-auto max-w-6xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="text-title font-black text-foreground mb-4">Pick Your Game</h2>
            <p className="text-body-fluid text-foreground/60">Six multiplayer games — no install required</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
            {playableGames.map((game, idx) => (
              <GameCatalogCard
                key={game.id}
                game={game}
                index={idx}
                variant="hero"
                playable
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Button
              variant="primary"
              size="touch"
              className="px-8 text-lg font-extrabold"
              onClick={() => router.push("/games")}
            >
              Explore All Games
            </Button>
          </motion.div>
        </motion.div>
      </section>
    </motion.div>
  );
}
