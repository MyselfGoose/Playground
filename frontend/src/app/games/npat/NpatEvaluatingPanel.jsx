"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Full-screen–friendly panel shown while the server scores the game (AI or offline rules).
 * Use anywhere `room.state === "EVALUATING"` should be visible (play page, etc.).
 */
export function NpatEvaluatingPanel({ className = "" }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[var(--radius-2xl)] border border-violet-200/70 bg-gradient-to-br from-violet-50/95 via-white to-indigo-50/40 px-6 py-14 text-center shadow-[var(--shadow-soft)] ring-1 ring-violet-100/80 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex flex-col items-center">
        <div className="relative h-16 w-16" aria-hidden>
          <span className="absolute inset-0 rounded-full border-[3px] border-violet-200/80" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-violet-600 border-r-violet-500/40" />
          <span className="absolute inset-[10px] animate-pulse rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 opacity-90 shadow-lg shadow-violet-500/25" />
        </div>
        <p className="mt-8 text-2xl font-black tracking-tight text-ink sm:text-3xl">Evaluating answers with AI</p>
        <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-ink-muted">
          We&apos;re scoring every round and every field. This usually takes just a few seconds — you&apos;ll jump to
          results automatically.
        </p>
      </div>
    </motion.div>
  );
}
