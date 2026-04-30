"use client";

import { motion } from "framer-motion";

export function LoadingSkeleton({ count = 3, variant = "card" }) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0.5 },
    show: { opacity: 1, transition: { duration: 0.6, repeat: Infinity, repeatType: "reverse" } },
  };

  if (variant === "card") {
    return (
      <motion.div
        className="space-y-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            variants={item}
            className="h-32 rounded-[var(--radius-2xl)] bg-gradient-to-r from-muted-bright/20 to-muted-bright/10"
          />
        ))}
      </motion.div>
    );
  }

  if (variant === "list") {
    return (
      <motion.div
        className="space-y-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            variants={item}
            className="h-16 rounded-[var(--radius-lg)] bg-gradient-to-r from-muted-bright/20 to-muted-bright/10"
          />
        ))}
      </motion.div>
    );
  }

  return null;
}
