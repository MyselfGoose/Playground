"use client";

import { cn } from "../../../../lib/taboo/cn.js";
import { useAdaptiveLayout } from "../../../../lib/adaptive/useAdaptiveLayout.js";

/**
 * @param {{
 *   header: import("react").ReactNode,
 *   banner?: import("react").ReactNode,
 *   children: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function TabooPlayShell({ header, banner, children, className }) {
  const { isTabletOrAbove, isLandscape, layoutProfile } = useAdaptiveLayout();
  const useSplit = isTabletOrAbove && layoutProfile === "split";

  return (
    <div className={cn("flex min-h-dvh flex-col text-taboo-text", className)}>
      {banner}
      {header}
      <main
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col px-4 py-4 pb-[calc(var(--keyboard-offset,0px)+env(safe-area-inset-bottom))]",
          useSplit
            ? "max-w-4xl md:grid md:grid-cols-[1fr_minmax(14rem,18rem)] md:gap-6 md:items-start"
            : "max-w-lg",
          isLandscape && !isTabletOrAbove && "play-landscape-compact",
        )}
      >
        {children}
      </main>
    </div>
  );
}
