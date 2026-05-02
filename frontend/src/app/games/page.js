"use client";

import Link from "next/link";
import { GAMES } from "../../lib/games.js";
import { motion } from "framer-motion";
import { Button } from "../../components/Button.jsx";

export default function GamesPage() {
  const playableGames = GAMES.filter(g =>
    ["name-place-animal-thing", "typing-race", "taboo", "cards-against-humanity", "hangman"].includes(g.id),
  );
  const comingSoonGames = GAMES.filter(
    g => !["name-place-animal-thing", "typing-race", "taboo", "cards-against-humanity", "hangman"].includes(g.id),
  );

  const getGameLink = (gameId) => {
    if (gameId === "name-place-animal-thing") return "/games/npat";
    if (gameId === "typing-race") return "/games/typing-race";
    if (gameId === "taboo") return "/games/taboo";
    if (gameId === "cards-against-humanity") return "/games/cah";
    if (gameId === "hangman") return "/games/hangman";
    return "/games";
  };

  const getGameColor = (idx) => {
    const colors = [
      "from-pastel-mint to-accent-mint",
      "from-pastel-sky to-accent-sky",
      "from-pastel-peach to-primary",
      "from-pastel-lavender to-accent-purple",
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      {/* HEADER */}
      <section className="px-4 py-16 sm:px-6 sm:py-24 bg-gradient-to-b from-muted-bright/20 to-transparent">
        <motion.div
          className="mx-auto max-w-5xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-foreground mb-4">
            Pick Your Game
          </h1>
          <p className="text-lg sm:text-xl text-foreground/70 max-w-2xl mx-auto">
            Choose from our collection of multiplayer games. Each one is designed for laughs, competition, and epic moments with friends.
          </p>
        </motion.div>
      </section>

      {/* PLAYABLE GAMES - FEATURED */}
      <section className="flex-1 px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl font-extrabold text-foreground mb-8"
          >
            Available Now
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {playableGames.map((game, idx) => {
              const colorClass = getGameColor(idx);
              const link = getGameLink(game.id);

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.12 }}
                  whileHover={{ y: -16 }}
                  className="group"
                >
                  <Link href={link}>
                    <div className={`relative h-full rounded-[var(--radius-2xl)] bg-gradient-to-br ${colorClass} p-8 sm:p-10 flex flex-col justify-between shadow-[var(--shadow-md)] ring-2 ring-foreground/10 hover:ring-foreground/20 hover:shadow-[var(--shadow-play)] transition-all duration-300 overflow-hidden cursor-pointer`}>
                      {/* Background accent */}
                      <motion.div
                        aria-hidden
                        className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity bg-background blur-2xl"
                      />

                      {/* Content */}
                      <div className="relative z-10">
                        <motion.div
                          className="text-5xl sm:text-6xl mb-4 inline-block"
                          whileHover={{ rotate: 12, scale: 1.1 }}
                        >
                          {game.emoji}
                        </motion.div>

                        <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-3 leading-tight">
                          {game.title}
                        </h3>

                        <p className="text-foreground/80 leading-relaxed text-sm sm:text-base">
                          {game.description}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="relative z-10 mt-6 pt-6 border-t border-foreground/15">
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="text-sm font-extrabold text-foreground group-hover:text-primary transition-colors flex items-center gap-2"
                        >
                          Play Now →
                        </motion.div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMING SOON - IF ANY */}
      {comingSoonGames.length > 0 && (
        <section className="px-4 py-12 sm:px-6 sm:py-20 bg-muted-bright/10">
          <div className="mx-auto max-w-6xl">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-2xl font-extrabold text-foreground mb-8"
            >
              Coming Soon
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {comingSoonGames.map((game, idx) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative rounded-[var(--radius-2xl)] bg-muted-bright/40 p-8 sm:p-10 ring-2 ring-muted-bright/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{game.emoji}</div>
                    <div>
                      <h3 className="font-bold text-foreground">{game.title}</h3>
                      <p className="text-sm text-foreground/60">Coming to Playground soon</p>
                    </div>
                  </div>
                  <div className="text-xs font-extrabold uppercase text-muted px-3 py-1.5 bg-muted/20 rounded-full">
                    Soon
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
