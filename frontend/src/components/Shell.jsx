"use client";

import { Navbar } from "./Navbar.jsx";

export function Shell({ children }) {
  return (
    <>
      <Navbar />
      <main className="relative flex flex-1 flex-col">{children}</main>
    </>
  );
}
