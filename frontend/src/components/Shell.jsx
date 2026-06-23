"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar.jsx";
import { SessionBanner } from "./SessionBanner.jsx";
import { NotificationToastHost } from "./notifications/NotificationToastHost.jsx";
import { isGameImmersiveRoute } from "../lib/adaptive/deviceClass.js";

export function Shell({ children }) {
  const pathname = usePathname() ?? "/";
  const immersive = isGameImmersiveRoute(pathname);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gameImmersive = immersive ? "true" : "false";
    if (immersive) {
      root.classList.add("play-landscape-compact");
    } else {
      root.classList.remove("play-landscape-compact");
    }
    return () => {
      delete root.dataset.gameImmersive;
      root.classList.remove("play-landscape-compact");
    };
  }, [immersive]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-[var(--shadow-md)] focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <Navbar />
      <NotificationToastHost />
      <SessionBanner />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex flex-1 flex-col pb-[env(safe-area-inset-bottom)] outline-none min-h-play-area"
      >
        {children}
      </main>
    </>
  );
}
