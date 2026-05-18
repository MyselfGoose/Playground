"use client";

import "./typing-multi.css";
import { Suspense } from "react";
import { TypingRaceProvider } from "../../../../lib/typing-race/TypingRaceSocketContext.jsx";
import { ErrorBoundary } from "../../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../../components/AuthGate.jsx";

export default function TypingMultiLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <TypingRaceProvider>
        <div className="typing-race-root flex min-h-[calc(100vh-4rem)] flex-col antialiased pb-[env(safe-area-inset-bottom)]">
          <Suspense
            fallback={
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center text-[var(--tt-ink-muted)]">
                Loading…
              </div>
            }
          >
            <AuthGate loginNext="/games/typing-race/multi">
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </AuthGate>
          </Suspense>
        </div>
      </TypingRaceProvider>
    </ErrorBoundary>
  );
}
