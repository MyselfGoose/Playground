"use client";

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
          {children}
        </TabooProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
