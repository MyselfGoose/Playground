"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "../lib/context/UserContext.jsx";

const AUTH_PATHS = new Set(["/login", "/register"]);

/**
 * Global session recovery banner when REST is degraded or auth must be renewed.
 */
export function SessionBanner() {
  const pathname = usePathname();
  const { user, loading, sessionError, lifecycle, reconcileNow } = useUser();

  if (loading || AUTH_PATHS.has(pathname)) return null;

  const showDegraded = lifecycle === "DEGRADED" && Boolean(sessionError);
  const showRecovering = lifecycle === "RECOVERING";
  const showSignedOutHint = !user && lifecycle === "SYNCED" && sessionError;

  if (!showDegraded && !showRecovering && !showSignedOutHint) return null;

  const message =
    sessionError ??
    (showRecovering ? "Restoring your session…" : "Connection problem. Try again or sign in.");

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-foreground"
    >
      <span>{message}</span>
      <span className="ml-3 inline-flex flex-wrap items-center justify-center gap-2">
        {(showDegraded || showSignedOutHint) && (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void reconcileNow()}
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
    </div>
  );
}
