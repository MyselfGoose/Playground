"use client";

import { Suspense } from "react";
import { TabooProvider } from "../../../lib/taboo/TabooSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";
import { TabooConnectionBanner } from "../../../components/connection/TabooConnectionBanner.jsx";

export default function TabooLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/taboo">
        <TabooProvider>
          <TabooConnectionBanner />
          <Suspense fallback={<div className="px-4 py-20 text-center font-semibold text-foreground/60">Loading…</div>}>
            {children}
          </Suspense>
        </TabooProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
