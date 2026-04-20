import { Suspense } from "react";
import { NpatResultClient } from "./NpatResultClient.jsx";

export default function NpatResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading results…</div>
      }
    >
      <NpatResultClient />
    </Suspense>
  );
}
