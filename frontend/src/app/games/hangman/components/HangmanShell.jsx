"use client";

import { motion } from "framer-motion";
import { formatConnectionStateLabel } from "../../../../lib/errors/mapConnectionError.js";

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   connected: boolean,
 *   connectionState: string,
 *   socketError?: string | null,
 *   isSyncing?: boolean,
 * }} props
 */
export function HangmanShell({ children, connected, connectionState, socketError, isSyncing }) {
  const pillVariant =
    socketError ? "danger" : isSyncing ? "warning" : connected ? "success" : "muted";

  const pillClass = {
    danger: "bg-error/15 text-error ring-error/30",
    warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-amber-500/30",
    success: "bg-accent-mint/20 text-foreground ring-accent-mint/40",
    muted: "bg-muted-bright/40 text-foreground/60 ring-muted-bright/50",
  }[pillVariant];

  const pillLabel = socketError
    ? socketError
    : isSyncing
      ? "Syncing room…"
      : formatConnectionStateLabel(connectionState);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] pb-[env(safe-area-inset-bottom)]">
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pastel-sky/40 via-background to-background"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div className="mx-auto flex max-w-6xl justify-end px-4 pt-3 sm:px-6">
        <span
          className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${pillClass}`}
          role="status"
        >
          <span
            className={`mr-2 h-2 w-2 shrink-0 rounded-full ${connected && !socketError ? "bg-accent-mint animate-pulse" : "bg-current opacity-60"}`}
          />
          <span className="truncate">{pillLabel}</span>
        </span>
      </motion.div>
      {children}
    </div>
  );
}
