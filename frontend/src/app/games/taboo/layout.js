"use client";

import { TabooProvider } from "../../../lib/taboo/TabooSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";

export default function TabooLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/taboo">
        <TabooProvider>{children}</TabooProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
