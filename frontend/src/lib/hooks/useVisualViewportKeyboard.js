"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * @param {Pick<VisualViewport, "height" | "offsetTop"> | null | undefined} visualViewport
 * @param {number} [windowInnerHeight]
 * @returns {number}
 */
export function computeKeyboardOffset(visualViewport, windowInnerHeight = typeof window !== "undefined" ? window.innerHeight : 0) {
  if (!visualViewport) {
    return 0;
  }
  return Math.max(0, windowInnerHeight - visualViewport.height - visualViewport.offsetTop);
}

/**
 * Tracks virtual keyboard via visualViewport and exposes --keyboard-offset on documentElement.
 *
 * @param {import('react').RefObject<HTMLElement | null>} scrollTargetRef
 * @param {{ enabled?: boolean; setOnDocument?: boolean; refocusInputRef?: import('react').RefObject<HTMLTextAreaElement | null> }} [options]
 */
export function useVisualViewportKeyboard(
  scrollTargetRef,
  { enabled = true, setOnDocument = true, refocusInputRef } = {},
) {
  const lastOffsetRef = useRef(0);

  const applyOffset = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const vv = window.visualViewport;
    const offset = computeKeyboardOffset(vv, window.innerHeight);

    if (setOnDocument) {
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    }

    if (enabled && offset > 0 && scrollTargetRef.current) {
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      scrollTargetRef.current.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }

    if (enabled && refocusInputRef?.current) {
      try {
        refocusInputRef.current.focus({ preventScroll: true });
      } catch {
        refocusInputRef.current.focus();
      }
    }

    lastOffsetRef.current = offset;
  }, [enabled, scrollTargetRef, setOnDocument, refocusInputRef]);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) {
      return undefined;
    }

    const vv = window.visualViewport;
    if (!vv) {
      return undefined;
    }

    applyOffset();

    vv.addEventListener("resize", applyOffset);
    vv.addEventListener("scroll", applyOffset);
    window.addEventListener("resize", applyOffset);

    return () => {
      vv.removeEventListener("resize", applyOffset);
      vv.removeEventListener("scroll", applyOffset);
      window.removeEventListener("resize", applyOffset);
      if (setOnDocument) {
        document.documentElement.style.setProperty("--keyboard-offset", "0px");
      }
    };
  }, [applyOffset, enabled, setOnDocument]);

  return { keyboardOffset: lastOffsetRef.current, refresh: applyOffset };
}
