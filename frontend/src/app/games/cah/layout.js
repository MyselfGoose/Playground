"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "../../../lib/context/UserContext.jsx";
import { CahProvider } from "../../../lib/cah/CahSocketContext.jsx";

export default function CahLayout({ children }) {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname || "/games/cah")}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return <div className="flex min-h-[60vh] items-center justify-center text-ink-muted">Loading…</div>;
  }

  return <CahProvider>{children}</CahProvider>;
}
