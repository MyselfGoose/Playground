"use client";

import { CahProvider } from "../../../lib/cah/CahSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";
import { CahConnectionBanner } from "../../../components/connection/CahConnectionBanner.jsx";

export default function CahLayout({ children }) {
  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/cah">
        <CahProvider>
          <CahConnectionBanner />
          {children}
        </CahProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
