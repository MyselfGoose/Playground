"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "../lib/context/UserContext.jsx";
import { LoadingSkeleton } from "./LoadingSkeleton.jsx";

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
  const reduce = useReducedMotion();
  const next = loginNext ?? pathname ?? "/games";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, next]);

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
        role="status"
        aria-live="polite"
      >
        <Image
          src="/brand/playground-mark.svg"
          alt=""
          width={56}
          height={56}
          className={`h-14 w-14 ${reduce ? "" : "animate-pulse opacity-90"}`}
          priority
        />
        <div className="w-full max-w-xs">
          <LoadingSkeleton variant="text" />
        </div>
        <p className="text-sm font-medium text-muted">Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <motion.div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
        role="status"
        aria-live="polite"
      >
        <Image
          src="/brand/playground-mark.svg"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 opacity-80"
        />
        <p className="text-sm font-medium text-muted">{message}</p>
      </motion.div>
    );
  }

  return children;
}
