"use client";

import { Navbar } from "./Navbar.jsx";
import { SessionBanner } from "./SessionBanner.jsx";

export function Shell({ children }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-[var(--shadow-md)] focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <Navbar />
      <SessionBanner />
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
