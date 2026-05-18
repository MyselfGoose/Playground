"use client";

import { usePathname } from "next/navigation";
import { HangmanProvider } from "../../../lib/hangman/HangmanSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";

export default function HangmanLayout({ children }) {
  const pathname = usePathname();
  const solo = pathname?.includes("/hangman/solo");

  if (solo) {
    return children;
  }

  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/hangman">
        <HangmanProvider>{children}</HangmanProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
