"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const TIPS = [
  "Unique answers often score higher than common ones.",
  "Spelling counts — close matches may still earn partial credit.",
  "All four categories are scored together for each letter.",
];

/**
 * @param {{
 *   evaluationSource?: 'gemini' | 'fallback' | null,
 *   className?: string,
 * }} props
 */
export function NpatEvaluatingPanel({ evaluationSource = null, className = "" }) {
  const reduce = useReducedMotion();
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [reduce]);

  const headline =
    evaluationSource === "gemini"
      ? "Scored with Google AI"
      : evaluationSource === "fallback"
        ? "Scored with standard rules"
        : "Scoring your answers";

  const subtitle =
    evaluationSource === "gemini"
      ? "Google AI is reviewing every round and field. Results open automatically when ready."
      : evaluationSource === "fallback"
        ? "Standard rules are scoring every round. Results open automatically when ready."
        : "We're scoring every round and every field. This usually takes just a few seconds.";

  const tip = TIPS[reduce ? 0 : tipIndex];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[var(--radius-2xl)] border border-muted-bright/70 bg-gradient-to-br from-pastel-lavender/35 via-background/90 to-pastel-sky/20 px-6 py-14 text-center shadow-[var(--shadow-soft)] ring-1 ring-foreground/10 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <motion.div
        className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-accent-purple/20 blur-3xl"
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-accent-sky/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex flex-col items-center">
        <div className="relative h-16 w-16" aria-hidden>
          <span className="absolute inset-0 rounded-full border-[3px] border-foreground/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary border-r-accent-purple/45" />
          <span className="absolute inset-[10px] animate-pulse rounded-full bg-gradient-to-br from-primary to-accent-purple opacity-90 shadow-lg shadow-primary/25" />
        </div>
        <p className="mt-8 text-2xl font-black tracking-tight text-ink sm:text-3xl">{headline}</p>
        <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-ink-muted">{subtitle}</p>
        <p className="mt-6 max-w-md text-xs font-semibold leading-relaxed text-ink-muted/90">{tip}</p>
      </div>
    </motion.div>
  );
}
