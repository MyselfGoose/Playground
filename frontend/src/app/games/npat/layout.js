import { Suspense } from "react";
import { NpatProvider } from "../../../lib/npat/NpatSocketContext.jsx";

export const metadata = {
  title: "Name Place Animal Thing — Playground",
  description: "Real-time multiplayer NPAT with friends.",
};

function NpatShellFallback() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center text-ink-muted">
      <p className="text-sm font-bold">Loading game…</p>
    </div>
  );
}

export default function NpatLayout({ children }) {
  return (
    <Suspense fallback={<NpatShellFallback />}>
      <NpatProvider>{children}</NpatProvider>
    </Suspense>
  );
}
