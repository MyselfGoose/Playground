"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** @typedef {'retry' | 'sign_in' | 'leave' | 'create_room'} ConnectionActionId */

const ACTION_LABELS = {
  retry: "Retry",
  sign_in: "Sign in",
  leave: "Back to games",
  create_room: "Create new game",
};

const STATE_STYLES = {
  connecting: "bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/30",
  reconnecting: "bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/30",
  offline: "bg-red-500/12 text-red-900 dark:text-red-100 border-red-500/25",
  "session-ended": "bg-red-600/15 text-red-950 dark:text-red-50 border-red-600/35",
  live: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 border-emerald-500/30",
};

/**
 * @param {{
 *   visible: boolean,
 *   state: string,
 *   message: string,
 *   actions?: ConnectionActionId[],
 *   showReconnected?: boolean,
 *   onRetry?: () => void,
 *   onCreateRoom?: () => void,
 * }} props
 */
export function ConnectionBanner({
  visible,
  state,
  message,
  actions = [],
  showReconnected = false,
  onRetry,
  onCreateRoom,
}) {
  const pathname = usePathname();
  if (!visible || !message) return null;

  const assertive = state === "session-ended";
  const style = showReconnected ? STATE_STYLES.live : (STATE_STYLES[state] ?? STATE_STYLES.connecting);
  const loginNext = pathname ? `/login?next=${encodeURIComponent(pathname)}` : "/login";

  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      className={`sticky top-0 z-40 border-b px-4 py-2.5 text-center text-sm font-semibold ${style}`}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
        {(state === "connecting" || state === "reconnecting") && !showReconnected ? (
          <span
            className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-current opacity-70"
            aria-hidden
          />
        ) : null}
        <span>{message}</span>
        {actions.length > 0 ? (
          <span className="flex flex-wrap items-center justify-center gap-2">
            {actions.map((action) => {
              if (action === "sign_in") {
                return (
                  <Link
                    key={action}
                    href={loginNext}
                    className="rounded-md border border-current/30 bg-background/80 px-2.5 py-1 text-xs font-bold hover:bg-background"
                  >
                    {ACTION_LABELS.sign_in}
                  </Link>
                );
              }
              if (action === "leave") {
                return (
                  <Link
                    key={action}
                    href="/games"
                    className="rounded-md border border-current/30 bg-background/80 px-2.5 py-1 text-xs font-bold hover:bg-background"
                  >
                    {ACTION_LABELS.leave}
                  </Link>
                );
              }
              if (action === "create_room" && onCreateRoom) {
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={onCreateRoom}
                    className="rounded-md border border-current/30 bg-background/80 px-2.5 py-1 text-xs font-bold hover:bg-background"
                  >
                    {ACTION_LABELS.create_room}
                  </button>
                );
              }
              if (action === "retry" && onRetry) {
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={onRetry}
                    className="rounded-md border border-current/30 bg-background/80 px-2.5 py-1 text-xs font-bold hover:bg-background"
                  >
                    {ACTION_LABELS.retry}
                  </button>
                );
              }
              return null;
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
