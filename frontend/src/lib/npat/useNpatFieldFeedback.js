"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 650;

/**
 * Brief overlay burst when a field submit succeeds.
 *
 * @param {{ reduceMotion?: boolean }} options
 */
export function useNpatFieldFeedback({ reduceMotion = false } = {}) {
  const [variant, setVariant] = useState(/** @type {'field_complete' | null} */ (null));
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pulseFieldComplete = useCallback(() => {
    if (reduceMotion) return;
    setVariant("field_complete");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVariant(null), FEEDBACK_MS);
  }, [reduceMotion]);

  return { variant, pulseFieldComplete };
}
