"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "../../../lib/context/UserContext.jsx";
import { HangmanProvider } from "../../../lib/hangman/HangmanSocketContext.jsx";

export default function HangmanLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();
  const solo = pathname?.includes("/hangman/solo");

  useEffect(() => {
    if (solo || loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname || "/games/hangman")}`);
  }, [solo, loading, user, router, pathname]);

  if (solo) return children;

  if (loading || !user) {
    return <div className="flex min-h-[60vh] items-center justify-center text-foreground/60">Loading…</div>;
  }

  return <HangmanProvider>{children}</HangmanProvider>;
}
