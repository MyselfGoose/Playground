"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "../components/Button.jsx";
import {
  getGameCardGradient,
  getGameHref,
  getPlayableGames,
} from "../lib/games.js";

export default function HomePage() {
  const router = useRouter();
  const playableGames = getPlayableGames();

  return (
    <motion.div
      className="w-full min-h-screen flex flex-col"
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
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-tight text-foreground mb-4"
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
              className="px-10 py-5 text-xl font-extrabold rounded-full shadow-[var(--shadow-play)] hover:scale-105"
              onClick={() => router.push("/games")}
            >
              Play Now
            </Button>
            <Button
              variant="secondary"
              className="px-10 py-5 text-xl font-extrabold rounded-full"
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
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-4">Pick Your Game</h2>
            <p className="text-lg text-foreground/60">Five multiplayer games — no install required</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {playableGames.map((game, idx) => {
              const colorClass = getGameCardGradient(idx);
              const href = getGameHref(game.id);

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.12 }}
                  whileHover={{ y: -12, scale: 1.02 }}
                  className="group"
                >
                  <Link
                    href={href}
                    className={`relative block rounded-[var(--radius-2xl)] bg-gradient-to-br ${colorClass} p-8 sm:p-12 min-h-64 flex flex-col items-center justify-center text-center shadow-[var(--shadow-md)] ring-2 ring-white/40 overflow-hidden`}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 rounded-[var(--radius-2xl)]"
                      aria-hidden
                    />

                    <div className="relative z-10">
                      <motion.div
                        className="text-6xl sm:text-7xl mb-4 inline-block group-hover:scale-125 transition-transform"
                        whileHover={{ rotate: 12 }}
                        aria-hidden
                      >
                        {game.emoji}
                      </motion.div>
                      <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
                        {game.title}
                      </h3>
                      <p className="text-sm sm:text-base text-foreground/75 leading-relaxed max-w-xs mx-auto">
                        {game.description}
                      </p>
                    </div>

                    <motion.div
                      className="absolute bottom-4 right-4 flex gap-1"
                      initial={{ opacity: 0.5 }}
                      aria-hidden
                    >
                      <motion.div className="w-2 h-2 rounded-full bg-white/40" />
                      <motion.div className="w-2 h-2 rounded-full bg-white/40" />
                      <motion.div className="w-2 h-2 rounded-full bg-white/40" />
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Button
              variant="primary"
              className="px-8 py-4 text-lg font-extrabold"
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
