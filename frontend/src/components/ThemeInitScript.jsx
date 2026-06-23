"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_INIT_SCRIPT } from "../lib/theme/themeInitScript.js";

/**
 * Injects the blocking theme script during SSR only (outside the client hydration tree).
 * Avoids React 19 warnings from rendering <script> inside layout on the client.
 */
export function ThemeInitScript() {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
  ));
  return null;
}
