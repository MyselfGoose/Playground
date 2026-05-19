"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HangmanProvider } from "../../../lib/hangman/HangmanSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";

function HangmanMultiplayerGate({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const loginNext = search ? `${pathname}?${search}` : pathname ?? "/games/hangman";

  return (
    <AuthGate loginNext={loginNext}>
      <HangmanProvider>{children}</HangmanProvider>
    </AuthGate>
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
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm font-semibold text-foreground/60">
            Loading…
          </div>
        }
      >
        <HangmanMultiplayerGate>{children}</HangmanMultiplayerGate>
      </Suspense>
    </ErrorBoundary>
  );
}
