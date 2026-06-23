"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/** @typedef {'success' | 'vote' | 'fool' | 'truth' | 'win' | 'default'} FibbageCelebrationType */

/**
 * @typedef {{
 *   message: string,
 *   type: FibbageCelebrationType,
 * }} FibbageFeedbackState
 */

/** @type {import('react').Context<{ flash: (message: string, type?: FibbageCelebrationType) => void, feedback: FibbageFeedbackState | null } | null>} */
const FibbageFeedbackContext = createContext(null);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function FibbageFeedbackProvider({ children }) {
  const [feedback, setFeedback] = useState(/** @type {FibbageFeedbackState | null} */ (null));
  const timeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const flash = useCallback((nextMessage, type = "default") => {
    if (!nextMessage) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const celebrationType = type === "default" ? inferType(nextMessage) : type;
    setFeedback({ message: nextMessage, type: celebrationType });
    timeoutRef.current = setTimeout(() => {
      setFeedback(null);
      timeoutRef.current = null;
    }, 1200);
  }, []);

  const value = useMemo(
    () => ({
      flash,
      feedback,
      /** @deprecated use feedback.message */
      message: feedback?.message ?? null,
    }),
    [flash, feedback],
  );

  return (
    <FibbageFeedbackContext.Provider value={value}>{children}</FibbageFeedbackContext.Provider>
  );
}

/**
 * @param {string} message
 * @returns {FibbageCelebrationType}
 */
function inferType(message) {
  const lower = message.toLowerCase();
  if (lower.includes("vote")) return "vote";
  if (lower.includes("fooled") || lower.includes("lie")) return "fool";
  if (lower.includes("truth")) return "truth";
  if (lower.includes("win") || lower.includes("everyone")) return "win";
  return "success";
}

export function useFibbageFeedback() {
  const ctx = useContext(FibbageFeedbackContext);
  if (!ctx) {
    throw new Error("useFibbageFeedback must be used within FibbageFeedbackProvider");
  }
  return ctx;
}
