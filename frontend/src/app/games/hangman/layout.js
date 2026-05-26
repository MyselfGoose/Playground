"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HangmanProvider } from "../../../lib/hangman/HangmanSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { GameAuthGate } from "../../../components/GameAuthGate.jsx";
import { HangmanConnectionBanner } from "../../../components/connection/HangmanConnectionBanner.jsx";

function HangmanMultiplayerGate({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const loginNext = search ? `${pathname}?${search}` : pathname ?? "/games/hangman";

  return (
    <GameAuthGate gameId="hangman" loginNext={loginNext}>
      <HangmanConnectionBanner />
      {children}
    </GameAuthGate>
  );
}

export default function HangmanLayout({ children }) {
  const pathname = usePathname();
  const solo = pathname?.includes("/hangman/solo");

  if (solo) {
    return children;
  }

  return (
    <ErrorBoundary level="game">
      <HangmanProvider>
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm font-semibold text-foreground/60">
              Loading…
            </div>
          }
        >
          <HangmanMultiplayerGate>{children}</HangmanMultiplayerGate>
        </Suspense>
      </HangmanProvider>
    </ErrorBoundary>
  );
}
