import { Suspense } from "react";
import { ProfileClient } from "./ProfileClient.jsx";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading…</div>
      }
    >
      <ProfileClient />
    </Suspense>
  );
}
