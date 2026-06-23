"use client";

import { useAdaptiveLayout } from "../../lib/adaptive/useAdaptiveLayout.js";

/**
 * @param {{
 *   children: import('react').ReactNode;
 *   className?: string;
 *   railClassName?: string;
 *   position?: 'bottom' | 'right' | 'auto';
 * }} props
 */
export function AdaptiveRail({
  children,
  className = "",
  railClassName = "",
  position = "auto",
}) {
  const { layoutProfile, isLandscapeShort, isTabletOrAbove } = useAdaptiveLayout();

  const resolvedPosition =
    position === "auto"
      ? layoutProfile === "rail-right" || isTabletOrAbove
        ? "right"
        : "bottom"
      : position;

  if (resolvedPosition === "right" && !isLandscapeShort) {
    return (
      <aside
        className={`lg:sticky lg:top-[calc(var(--app-chrome-height)+var(--space-4))] lg:self-start ${railClassName} ${className}`}
      >
        {children}
      </aside>
    );
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-muted-bright/30 bg-background/95 px-4 py-3 backdrop-blur-md pb-[calc(var(--space-3)+env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none ${railClassName} ${className}`}
    >
      {children}
    </div>
  );
}
