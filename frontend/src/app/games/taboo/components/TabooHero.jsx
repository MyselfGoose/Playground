"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";
import { motionPresets } from "../../../../lib/taboo/motion.js";

/**
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   eyebrow?: string,
 *   align?: "left" | "center",
 *   className?: string,
 * }} props
 */
export function TabooHero({
  title = "Taboo",
  subtitle = "The ultimate party word game",
  eyebrow,
  align = "center",
  className,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      className={cn(align === "center" ? "text-center" : "text-left", className)}
      {...(reduceMotion ? {} : motionPresets.pageEnter)}
    >
      <motion.div
        className={cn(
          "taboo-hero-icon mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl sm:h-[4.25rem] sm:w-[4.25rem]",
          align === "center" ? "mx-auto" : "",
        )}
        initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Sparkles className="h-7 w-7 text-white" strokeWidth={2} aria-hidden />
      </motion.div>
      {eyebrow ? (
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--taboo-text-tertiary)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--taboo-text)] sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-taboo-text-muted">{subtitle}</p>
      ) : null}
    </motion.header>
  );
}
