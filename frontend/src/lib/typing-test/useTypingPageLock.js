"use client";

import { useEffect } from "react";

/**
 * Prevent document scroll while a typing test or race is active.
 *
 * @param {boolean} active
 */
export function useTypingPageLock(active) {
  useEffect(() => {
    if (typeof document === "undefined" || !active) {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.classList.add("typing-scroll-lock");

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.classList.remove("typing-scroll-lock");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" in window ? "instant" : "auto" });
    };
  }, [active]);
}
