"use client";

import { useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Returns `true` after `timeoutMs` if `connected` never becomes `true`.
 * Resets when `connected` becomes `true` or the component remounts.
 */
export function useConnectionTimeout(connected, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (connected) {
      setTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [connected, timeoutMs]);

  return timedOut;
}
