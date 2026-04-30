"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../components/Button.jsx";

const GAMES = [
  { id: "npat", name: "Name Place Animal Thing", emoji: "🌍", color: "from-accent-mint to-accent-sky" },
  { id: "typing", name: "Typing Race", emoji: "⌨️", color: "from-accent-sky to-accent-purple" },
  { id: "taboo", name: "Taboo", emoji: "🎯", color: "from-accent-pink to-primary" },
];

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* HERO SECTION - BOLD AND LARGE */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-20 sm:px-6 sm:py-32 overflow-hidden">
        {/* Animated background orbs */}
        {!reduce ? (
          <>
            <motion.div
              aria-hidden
              className="absolute top-20 -left-40 w-80 h-80 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 blur-3xl"
              animate={{
                y: [0, 40, 0],
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="absolute bottom-20 -right-40 w-96 h-96 rounded-full bg-gradient-to-tl from-accent-purple/25 to-accent-pink/25 blur-3xl"
              animate={{
                y: [0, -40, 0],
                x: [0, 20, 0],
              }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-accent-lemon/20 to-transparent blur-3xl"
              animate={{
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        ) : null}

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
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-4">Pick Your Game</h2>
            <p className="text-lg text-foreground/60">Three ways to have fun with friends</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {GAMES.map((game, idx) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                whileHover={{ y: -12, scale: 1.02 }}
                onClick={() => router.push("/games")}
                className={`relative group cursor-pointer rounded-[var(--radius-2xl)] bg-gradient-to-br ${game.color} p-8 sm:p-12 min-h-64 flex flex-col items-center justify-center text-center shadow-[var(--shadow-md)] ring-2 ring-white/40 overflow-hidden`}
              >
                {/* Glow effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 rounded-[var(--radius-2xl)]"
                  aria-hidden
                />

                {/* Content */}
                <motion.div
                  className="relative z-10"
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    className="text-6xl sm:text-7xl mb-4 inline-block group-hover:scale-125 transition-transform"
                    whileHover={{ rotate: 12 }}
                  >
                    {game.emoji}
                  </motion.div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
                    {game.name}
                  </h3>
                </motion.div>

                {/* Decorative dots bottom right */}
                <motion.div
                  className="absolute bottom-4 right-4 flex gap-1"
                  initial={{ opacity: 0.5 }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                </motion.div>
              </motion.div>
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
              className="px-8 py-4 text-lg font-extrabold"
              onClick={() => router.push("/games")}
            >
              Explore All Games
            </Button>
          </motion.div>
        </div>
      </section>

      {/* STATS/FEATURE SECTION */}
      <section className="px-4 py-20 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          >
            {[
              { num: "3", label: "Games" },
              { num: "∞", label: "Fun" },
              { num: "📈", label: "Leaderboards" },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-[var(--radius-xl)] bg-muted-bright/30 ring-1 ring-muted-bright/50"
              >
                <div className="text-4xl sm:text-5xl font-black text-primary mb-3">
                  {item.num}
                </div>
                <p className="text-lg font-bold text-foreground">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
