"use client";

import "../fibbage-theme.css";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function FibbageThemeShell({ children }) {
  return (
    <div className="fibbage-theme relative flex min-h-dvh flex-col">
      <div className="relative z-10 flex min-h-dvh flex-1 flex-col">{children}</div>
    </div>
  );
}
