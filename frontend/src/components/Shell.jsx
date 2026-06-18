"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar.jsx";
import { SessionBanner } from "./SessionBanner.jsx";
import { NotificationToastHost } from "./notifications/NotificationToastHost.jsx";

/** Immersive game routes hide the global navbar (full-screen game chrome). */
function isImmersiveGameRoute(pathname) {
  return pathname?.startsWith("/games/taboo");
}

export function Shell({ children }) {
  const pathname = usePathname();
  const immersive = isImmersiveGameRoute(pathname);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-[var(--shadow-md)] focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      {immersive ? null : <Navbar />}
      <NotificationToastHost />
      {immersive ? null : <SessionBanner />}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex flex-1 flex-col pb-[env(safe-area-inset-bottom)] outline-none"
      >
        {children}
      </main>
    </>
  );
}
