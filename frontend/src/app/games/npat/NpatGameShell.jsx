"use client";

import { NpatProvider } from "../../../lib/npat/NpatSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { GameAuthGate } from "../../../components/GameAuthGate.jsx";
import { NpatConnectionBanner } from "../../../components/connection/NpatConnectionBanner.jsx";

export default function NpatGameShell({ children }) {
  return (
    <ErrorBoundary level="game">
      <NpatProvider>
        <GameAuthGate gameId="npat" loginNext="/games/npat">
          <NpatConnectionBanner />
          {children}
        </GameAuthGate>
      </NpatProvider>
    </ErrorBoundary>
  );
}
