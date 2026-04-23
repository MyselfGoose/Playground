"use client";

import "./typing-multi.css";
import { Suspense, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TypingRaceProvider } from "../../../../lib/typing-race/TypingRaceSocketContext.jsx";
import { useUser } from "../../../../lib/context/UserContext.jsx";

function MultiAuthShell({ children }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      const search = searchParams.toString();
      const next = `${pathname}${search ? `?${search}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, pathname, searchParams]);

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center text-[var(--tt-ink-muted)]">
        Redirecting to sign in…
      </div>
    );
  }
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

export default function TypingMultiLayout({ children }) {
  return (
    <TypingRaceProvider>
      {/* Full-bleed dark shell so the typing theme is not a narrow strip on the site canvas */}
      <div className="typing-race-root flex min-h-[calc(100vh-4rem)] flex-col antialiased">
        <Suspense
          fallback={
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center text-[var(--tt-ink-muted)]">
              Loading…
            </div>
          }
        >
          <MultiAuthShell>{children}</MultiAuthShell>
        </Suspense>
      </div>
    </TypingRaceProvider>
  );
}
