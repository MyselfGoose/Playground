"use client";

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
 * Shown only for real connection problems or a one-shot session-ended notice
 * after the user was signed in — never for routine guest browsing.
 */
export function SessionBanner() {
  const pathname = usePathname();
  const {
    user,
    loading,
    sessionError,
    sessionNotice,
    lifecycle,
    dismissSessionNotice,
    reconcileNow,
  } = useUser();

  if (loading || shouldHideBanner(pathname)) return null;

  const showDegraded = lifecycle === "DEGRADED" && Boolean(sessionError);
  const showSessionEnded = !user && Boolean(sessionNotice);

  if (!showDegraded && !showSessionEnded) return null;

  const message = showSessionEnded
    ? sessionNotice
    : (sessionError ?? "Connection problem. Try again or sign in.");

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-0 top-16 z-40 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-foreground shadow-sm backdrop-blur-sm"
    >
      <span>{message}</span>
      <span className="ml-3 inline-flex flex-wrap items-center justify-center gap-2">
        {showDegraded ? (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void reconcileNow("manual_retry", { forceVisible: true })}
          >
            Retry
          </button>
        ) : null}
        {showSessionEnded ? (
          <>
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={dismissSessionNotice}
            >
              Dismiss
            </button>
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="font-semibold underline underline-offset-2"
            >
              Sign in
            </Link>
          </>
        ) : null}
        {showDegraded && !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="font-semibold underline underline-offset-2"
          >
            Sign in
          </Link>
        ) : null}
      </span>
    </div>
  );
}
