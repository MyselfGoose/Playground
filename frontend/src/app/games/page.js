"use client";

import { GAMES } from "../../lib/games.js";
import { GameCard } from "../../components/GameCard.jsx";

export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-widest text-accent">
          Game room
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          What do you feel like playing?
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Tap a card — most are still warming up, but the vibes are ready.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {GAMES.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} />
        ))}
      </div>
    </div>
  );
}
