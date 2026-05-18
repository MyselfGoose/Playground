/** @typedef {'light' | 'dark'} Theme */

/**
 * @returns {Theme | null}
 */
export function getStoredTheme() {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return null;
}

/**
 * @param {Theme | null} stored
 * @param {boolean} prefersDark
 * @returns {Theme}
 */
export function resolveTheme(stored, prefersDark) {
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return prefersDark ? "dark" : "light";
}

/**
 * @param {Theme} theme
 */
export function applyThemeClass(theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
  }
  localStorage.setItem("theme", theme);
}

/**
 * Read resolved theme from the document (after inline FOUC script).
 * @returns {Theme}
 */
export function readThemeFromDocument() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
