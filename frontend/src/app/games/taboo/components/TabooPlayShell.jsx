"use client";

import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   header: import("react").ReactNode,
 *   banner?: import("react").ReactNode,
 *   children: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function TabooPlayShell({ header, banner, children, className }) {
  return (
    <div className={cn("flex min-h-dvh flex-col text-taboo-text", className)}>
      {banner}
      {header}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4 pb-[calc(var(--keyboard-offset,0px)+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
