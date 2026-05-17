"use client";

import { motion } from "framer-motion";

/**
 * Full-viewport overlay for Google OAuth handoff states.
 * @param {{ title: string, subtitle?: string, children?: import('react').ReactNode }} props
 */
export function OAuthFullScreenShell({ title, subtitle, children }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div className="w-full max-w-md text-center">
        {children ?? (
          <div
            className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"
            role="status"
            aria-label="Loading"
          />
        )}
        <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-foreground/60">{subtitle}</p> : null}
      </motion.div>
    </motion.div>
  );
}
