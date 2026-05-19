"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * @param {{ label?: string, variant?: 'dealing' | 'waiting' }} props
 */
export default function DealingStack({ label = "Dealing cards…", variant = "dealing" }) {
  const reduceMotion = useReducedMotion();
  const cards = [0, 1, 2, 3, 4];

  return (
    <motion.div
      className="flex flex-col items-center gap-4 py-6"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.p
        className={`text-sm font-semibold ${variant === "waiting" ? "text-warning" : "text-foreground/75"}`}
        animate={reduceMotion ? undefined : { opacity: [0.65, 1, 0.65] }}
        transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity }}
      >
        {label}
      </motion.p>
      <motion.div className="relative h-36 w-28" aria-hidden>
        {cards.map((i) => (
          <motion.div
            key={i}
            className="absolute inset-x-0 mx-auto h-32 w-24 rounded-[18px] border-2 border-white/25 bg-gradient-to-br from-neutral-800 to-black shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
            style={{ zIndex: i, rotate: (i - 2) * 4 }}
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [0, -4 - i, 0],
                    rotate: [(i - 2) * 4, (i - 2) * 4 + 2, (i - 2) * 4],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration: 1.2 + i * 0.08, repeat: Infinity, ease: "easeInOut", delay: i * 0.06 }
            }
          >
            <motion.div
              className="absolute inset-3 rounded-[12px] border border-dashed border-white/20"
              animate={reduceMotion ? undefined : { opacity: [0.25, 0.5, 0.25] }}
              transition={reduceMotion ? undefined : { duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
