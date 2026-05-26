"use client";

import { CahProvider } from "../../../lib/cah/CahSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { GameAuthGate } from "../../../components/GameAuthGate.jsx";
import { CahConnectionBanner } from "../../../components/connection/CahConnectionBanner.jsx";

export default function CahLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <CahProvider>
        <GameAuthGate gameId="cah" loginNext="/games/cah">
          <CahConnectionBanner />
          {children}
        </GameAuthGate>
      </CahProvider>
    </ErrorBoundary>
  );
}
