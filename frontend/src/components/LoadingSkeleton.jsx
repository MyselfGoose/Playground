"use client";

import { motion, useReducedMotion } from "framer-motion";

const pulseItem = {
  hidden: { opacity: 0.5 },
  show: { opacity: 1, transition: { duration: 0.6, repeat: Infinity, repeatType: "reverse" } },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

function SkeletonBar({ className = "" }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div
        className={`rounded-[var(--radius-lg)] bg-muted-bright/30 ${className}`}
        aria-hidden
      />
    );
  }
  return (
    <motion.div
      variants={pulseItem}
      className={`rounded-[var(--radius-lg)] bg-gradient-to-r from-muted-bright/20 to-muted-bright/10 ${className}`}
      aria-hidden
    />
  );
}

/** @param {{ count?: number; variant?: 'card' | 'list' | 'lobby' | 'text' }} props */
export function LoadingSkeleton({ count = 3, variant = "card" }) {
  const reduce = useReducedMotion();

  if (variant === "text") {
    return (
      <motion.div
        className="space-y-3"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        aria-busy="true"
        aria-label="Loading"
      >
        <SkeletonBar className="h-4 w-full max-w-md" />
        <SkeletonBar className="h-4 w-full max-w-[85%]" />
        <SkeletonBar className="h-3 w-full max-w-[65%]" />
      </motion.div>
    );
  }

  if (variant === "lobby") {
    return (
      <motion.div
        className="space-y-6"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        aria-busy="true"
        aria-label="Loading lobby"
      >
        <SkeletonBar className="h-12 w-40 mx-auto" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBar className="h-10 w-10 shrink-0 rounded-full" />
              <SkeletonBar className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (variant === "list") {
    return (
      <motion.div
        className="space-y-3"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonBar key={i} className="h-16" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      variants={container}
      initial={reduce ? false : "hidden"}
      animate="show"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBar key={i} className="h-32 rounded-[var(--radius-2xl)]" />
      ))}
    </motion.div>
  );
}
