"use client";

import { GAMES } from "../../lib/games.js";
import { GameCard } from "../../components/GameCard.jsx";
import { motion } from "framer-motion";

export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
      <motion.header 
        className="mb-12 max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.p 
          className="text-sm font-extrabold uppercase tracking-widest bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🎮 Game Room
        </motion.p>
        <h1 className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
          What do you feel like playing?
        </h1>
        <p className="mt-4 text-lg text-foreground/70">
          Pick your favorite — each game brings new vibes and endless fun with friends.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 gap-y-8">
        {GAMES.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} />
        ))}
      </div>
    </div>
  );
}
