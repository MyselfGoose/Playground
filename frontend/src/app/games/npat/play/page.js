import { Suspense } from "react";
import { NpatPlayClient } from "./NpatPlayClient.jsx";

export default function NpatPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading game…</div>
      }
    >
      <NpatPlayClient />
    </Suspense>
  );
}
