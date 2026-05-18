"use client";

import { NpatProvider } from "../../../lib/npat/NpatSocketContext.jsx";
import { ErrorBoundary } from "../../../components/ErrorBoundary.jsx";
import { AuthGate } from "../../../components/AuthGate.jsx";

export default function NpatGameShell({ children }) {
  return (
    <ErrorBoundary level="game">
      <AuthGate loginNext="/games/npat">
        <NpatProvider>{children}</NpatProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
