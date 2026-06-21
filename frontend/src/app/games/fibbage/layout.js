"use client";

import { Suspense } from "react";
import { FibbageProvider } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { GameAuthGate } from "../../../components/GameAuthGate.jsx";
import { FibbageThemeShell } from "./components/FibbageThemeShell.jsx";
import { FibbageConnectionBanner } from "../../../components/connection/FibbageConnectionBanner.jsx";

export default function FibbageLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <FibbageProvider>
        <GameAuthGate gameId="fibbage" loginNext="/games/fibbage">
          <FibbageThemeShell>
            <FibbageConnectionBanner />
            <Suspense
              fallback={
                <div className="flex min-h-[50dvh] items-center justify-center px-4 py-20">
                  <p className="text-sm" style={{ color: "var(--fibbage-text-muted)" }}>Loading Fibbage...</p>
                </div>
              }
            >
              {children}
            </Suspense>
          </FibbageThemeShell>
        </GameAuthGate>
      </FibbageProvider>
    </ErrorBoundary>
  );
}
