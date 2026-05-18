"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyThemeClass,
  getStoredTheme,
  readThemeFromDocument,
  resolveTheme,
} from "./themeUtils.js";

/** @typedef {'light' | 'dark'} Theme */

/** @type {import('react').Context<{
 *   theme: Theme;
 *   isDark: boolean;
 *   ready: boolean;
 *   setTheme: (theme: Theme) => void;
 *   toggleTheme: () => void;
 * } | null>} */
const ThemeContext = createContext(null);

/**
 * Resolve theme for client hydration (matches public/theme-init.js).
 * @returns {Theme}
 */
function resolveClientTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  const onDocument = readThemeFromDocument();
  if (onDocument === "dark" || onDocument === "light") return onDocument;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveTheme(stored, prefersDark);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(/** @type {Theme} */ ("light"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const resolved = resolveClientTheme();
    applyThemeClass(resolved);
    setThemeState(resolved);
    setReady(true);
  }, []);

  const setTheme = useCallback((next) => {
    applyThemeClass(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyThemeClass(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      ready,
      setTheme,
      toggleTheme,
    }),
    [theme, ready, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
