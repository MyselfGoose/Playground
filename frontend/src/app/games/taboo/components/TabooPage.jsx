"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../../../lib/taboo/cn.js";
import { motionPresets } from "../../../../lib/taboo/motion.js";

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   className?: string,
 *   maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl",
 *   stagger?: boolean,
 * }} props
 */
export function TabooPage({ children, className, maxWidth = "lg", stagger = true }) {
  const reduceMotion = useReducedMotion();
  const maxWidthClass =
    maxWidth === "sm"
      ? "max-w-sm"
      : maxWidth === "md"
        ? "max-w-md"
        : maxWidth === "xl"
          ? "max-w-xl"
          : maxWidth === "2xl"
            ? "max-w-2xl"
            : maxWidth === "3xl"
              ? "max-w-3xl"
              : maxWidth === "4xl"
                ? "max-w-4xl"
                : "max-w-lg";

  if (stagger && !reduceMotion) {
    return (
      <motion.main
        className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-6", maxWidthClass, className)}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {children}
      </motion.main>
    );
  }

  return (
    <main className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-6", maxWidthClass, className)}>
      {children}
    </main>
  );
}

/**
 * Stagger child wrapper for TabooPage
 * @param {{ children: import("react").ReactNode, className?: string }} props
 */
export function TabooPageSection({ children, className }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: motionPresets.sectionEnter(0).initial,
        visible: motionPresets.sectionEnter(0).animate,
      }}
      transition={motionPresets.sectionEnter(0).transition}
    >
      {children}
    </motion.div>
  );
}
