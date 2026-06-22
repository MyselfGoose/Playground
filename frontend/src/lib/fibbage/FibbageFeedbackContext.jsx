"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/** @type {import('react').Context<{ flash: (message: string) => void, message: string | null } | null>} */
const FibbageFeedbackContext = createContext(null);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function FibbageFeedbackProvider({ children }) {
  const [message, setMessage] = useState(/** @type {string | null} */ (null));
  const timeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const flash = useCallback((nextMessage) => {
    if (!nextMessage) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(nextMessage);
    timeoutRef.current = setTimeout(() => {
      setMessage(null);
      timeoutRef.current = null;
    }, 1200);
  }, []);

  const value = useMemo(() => ({ flash, message }), [flash, message]);

  return (
    <FibbageFeedbackContext.Provider value={value}>{children}</FibbageFeedbackContext.Provider>
  );
}

export function useFibbageFeedback() {
  const ctx = useContext(FibbageFeedbackContext);
  if (!ctx) {
    throw new Error("useFibbageFeedback must be used within FibbageFeedbackProvider");
  }
  return ctx;
}
