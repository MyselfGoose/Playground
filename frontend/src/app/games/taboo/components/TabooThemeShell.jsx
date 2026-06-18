"use client";

import { TabooAmbientBackground } from "./TabooAmbientBackground.jsx";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function TabooThemeShell({ children }) {
  return (
    <div className="taboo-theme relative flex min-h-dvh flex-col text-taboo-text">
      <TabooAmbientBackground />
      <div className="relative z-10 flex min-h-dvh flex-1 flex-col">{children}</div>
    </div>
  );
}
