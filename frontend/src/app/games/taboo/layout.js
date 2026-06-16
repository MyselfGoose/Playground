"use client";

import { Suspense } from "react";
import { TabooProvider } from "../../../lib/taboo/TabooSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { GameAuthGate } from "../../../components/GameAuthGate.jsx";
import { TabooConnectionBanner } from "../../../components/connection/TabooConnectionBanner.jsx";
import { TabooThemeShell } from "./components/TabooThemeShell.jsx";
import { TabooSpinner } from "./ui/TabooSpinner.jsx";

export default function TabooLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <TabooProvider>
        <GameAuthGate gameId="taboo" loginNext="/games/taboo">
          <TabooThemeShell>
            <TabooConnectionBanner />
            <Suspense
              fallback={
                <div className="flex min-h-[50dvh] items-center justify-center px-4 py-20">
                  <TabooSpinner label="Loading Taboo…" />
                </div>
              }
            >
              {children}
            </Suspense>
          </TabooThemeShell>
        </GameAuthGate>
      </TabooProvider>
    </ErrorBoundary>
  );
}
