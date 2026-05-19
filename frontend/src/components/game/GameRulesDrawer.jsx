"use client";

import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";

/**
 * @param {{
 *   gameId: string;
 *   title: string;
 *   children: import('react').ReactNode;
 * }} props
 */
export function GameRulesDrawer({ gameId, title, children }) {
  const storageKey = `rules_seen_${gameId}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) setOpen(true);
    } catch {
      setOpen(false);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`rules-${gameId}-title`}
    >
      <div className="w-full max-w-md rounded-[var(--radius-2xl)] border border-muted-bright/50 bg-background p-6 shadow-[var(--shadow-lg)]">
        <h2 id={`rules-${gameId}-title`} className="text-xl font-black text-foreground">
          {title}
        </h2>
        <div className="mt-4 space-y-2 text-sm font-semibold leading-relaxed text-foreground/75">
          {children}
        </div>
        <Button type="button" variant="primary" className="mt-6 w-full" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
