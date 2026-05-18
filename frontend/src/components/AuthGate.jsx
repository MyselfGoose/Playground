"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "../lib/context/UserContext.jsx";

/**
 * Client-side auth guard for game routes. Shows a calm loading state while session
 * hydrates, then redirects unauthenticated users without flashing game chrome.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   loginNext?: string,
 *   message?: string,
 * }} props
 */
export function AuthGate({ children, loginNext, message = "Taking you to sign in…" }) {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const next = loginNext ?? pathname ?? "/games";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, next]);

  if (loading) {
    return (
      <motion.div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm font-medium text-foreground/60">Loading…</p>
      </motion.div>
    );
  }

  if (!user) {
    return (
      <motion.div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
        <motion.div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          role="status"
          aria-label="Redirecting"
        />
        <p className="text-sm font-medium text-foreground/60">{message}</p>
      </motion.div>
    );
  }

  return children;
}
