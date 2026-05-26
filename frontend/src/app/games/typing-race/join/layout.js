"use client";

import { Suspense } from "react";
import { GameAuthGate } from "../../../../components/GameAuthGate.jsx";

export default function TypingRaceJoinLayout({ children }) {
  return (
    <GameAuthGate gameId="typing-race" loginNext="/games/typing-race/join">
      <Suspense
        fallback={
          <div className="mx-auto flex min-h-[40vh] w-full max-w-2xl flex-1 items-center justify-center px-4 py-16 text-center text-[var(--tt-ink-muted)]">
            Loading…
          </div>
        }
      >
        {children}
      </Suspense>
    </GameAuthGate>
  );
}
