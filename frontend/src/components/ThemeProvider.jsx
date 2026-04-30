"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }) {
  useEffect(() => {
    const html = document.documentElement;
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (saved === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else if (saved === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else if (prefersDark) {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
    }
  }, []);

  return <>{children}</>;
}
