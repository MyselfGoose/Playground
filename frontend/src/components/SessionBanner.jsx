"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "../lib/context/UserContext.jsx";

const HIDDEN_BANNER_PREFIXES = ["/login", "/register", "/auth/google"];

function shouldHideBanner(pathname) {
  return HIDDEN_BANNER_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Shown only for real connection/auth problems — not routine background reconcile.
 */
export function SessionBanner() {
  const pathname = usePathname();
  const { user, loading, sessionError, lifecycle, reconcileNow } = useUser();

  if (loading || shouldHideBanner(pathname)) return null;

  const showDegraded = lifecycle === "DEGRADED" && Boolean(sessionError);
  const showSignedOutHint = !user && lifecycle === "SYNCED" && sessionError;

  if (!showDegraded && !showSignedOutHint) return null;

  const message = sessionError ?? "Connection problem. Try again or sign in.";

  return (
    <motion.div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-foreground"
    >
      <span>{message}</span>
      <span className="ml-3 inline-flex flex-wrap items-center justify-center gap-2">
        {(showDegraded || showSignedOutHint) && (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void reconcileNow("manual_retry", { forceVisible: true })}
          >
            Retry
          </button>
        )}
        {!user && (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="font-semibold underline underline-offset-2"
          >
            Sign in
          </Link>
        )}
      </span>
    </motion.div>
  );
}
