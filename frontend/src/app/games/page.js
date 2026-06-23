"use client";

import {
  getComingSoonGames,
  getPlayableGames,
} from "../../lib/games.js";
import { motion } from "framer-motion";
import { PageHeader } from "../../components/PageHeader.jsx";
import { GameCatalogCard } from "../../components/adaptive/GameCatalogCard.jsx";

export default function GamesPage() {
  const playableGames = getPlayableGames();
  const comingSoonGames = getComingSoonGames();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <section className="bg-gradient-to-b from-muted-bright/20 to-transparent px-4 py-12 sm:px-6 sm:py-20">
        <PageHeader
          title="Pick Your Game"
          description="Choose from our collection of multiplayer games. Each one is designed for laughs, competition, and epic moments with friends."
          align="center"
          size="md"
        />
      </section>

      <section className="flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <div className="adaptive-content-anchored mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-6 text-2xl font-extrabold text-foreground"
          >
            Available Now
          </motion.h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
            {playableGames.map((game, idx) => (
              <GameCatalogCard
                key={game.id}
                game={game}
                index={idx}
                variant="grid"
                playable
              />
            ))}
          </div>

          {comingSoonGames.length > 0 ? (
            <div className="mt-16">
              <h2 className="mb-6 text-xl font-extrabold text-foreground">Coming Soon</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {comingSoonGames.map((game, idx) => (
                  <GameCatalogCard
                    key={game.id}
                    game={game}
                    index={idx}
                    variant="grid"
                    playable={false}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
