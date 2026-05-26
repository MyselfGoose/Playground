"use client";

import { useEffect, useState } from "react";

const DESKTOP_MQ = "(min-width: 768px)";

/** @typedef {{ visibleLines: number; focusLineIndex: number }} ViewportLineConfig */

/**
 * Responsive typing viewport: 4 lines on desktop, 3 on mobile; active line at top.
 *
 * @returns {ViewportLineConfig}
 */
export function useViewportLineConfig() {
  const [config, setConfig] = useState(
    /** @type {ViewportLineConfig} */ ({ visibleLines: 4, focusLineIndex: 0 }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => {
      setConfig({
        visibleLines: mq.matches ? 4 : 3,
        focusLineIndex: 0,
      });
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return config;
}
