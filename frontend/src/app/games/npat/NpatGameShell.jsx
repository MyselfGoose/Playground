"use client";

import { NpatProvider } from "../../../lib/npat/NpatSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";
import { NpatConnectionBanner } from "../../../components/connection/NpatConnectionBanner.jsx";

export default function NpatGameShell({ children }) {
  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/npat">
        <NpatProvider>
          <NpatConnectionBanner />
          {children}
        </NpatProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
