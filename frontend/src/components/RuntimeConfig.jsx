"use client";

import { useEffect } from "react";

/**
 * Injects __PLAYGROUNDS_CONFIG__ on the client from build-time-inlined
 * NEXT_PUBLIC_* env vars, without requiring force-dynamic on the root layout.
 * This runs once on mount and populates the global config that api.js reads.
 */
function sameOriginApiMode() {
  const v = String(process.env.NEXT_PUBLIC_SAME_ORIGIN_API ?? "").trim();
  return v === "1" || v.toLowerCase() === "true";
}

export function RuntimeConfig() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__PLAYGROUNDS_CONFIG__) return;
    const socketUrl = String(process.env.NEXT_PUBLIC_SOCKET_URL ?? "").trim();
    const apiBase = sameOriginApiMode()
      ? ""
      : String(process.env.NEXT_PUBLIC_API_URL ?? "").trim();
    if (apiBase || socketUrl || sameOriginApiMode()) {
      window.__PLAYGROUNDS_CONFIG__ = {
        apiBase,
        socketUrl: socketUrl || apiBase,
        sameOriginApi: sameOriginApiMode(),
      };
    }
  }, []);
  return null;
}
