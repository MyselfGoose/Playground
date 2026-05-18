"use client";

import { Navbar } from "./Navbar.jsx";
import { SessionBanner } from "./SessionBanner.jsx";

export function Shell({ children }) {
  return (
    <>
      <Navbar />
      <SessionBanner />
      <main className="relative flex flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{children}</main>
    </>
  );
}
