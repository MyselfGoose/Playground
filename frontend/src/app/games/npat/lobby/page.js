import { Suspense } from "react";
import { NpatLobbyClient } from "./NpatLobbyClient.jsx";

export default function NpatLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading lobby…</div>
      }
    >
      <NpatLobbyClient />
    </Suspense>
  );
}
