"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../components/Button.jsx";

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {!reduce ? (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full bg-butter/80 blur-2xl"
            animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-40 h-64 w-64 rounded-full bg-mint/70 blur-2xl"
            animate={{ y: [0, 14, 0], x: [0, -10, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-10 left-1/3 h-48 w-48 rounded-full bg-peach/60 blur-2xl"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}

      <div className="relative z-[1] mx-auto flex w-full max-w-3xl flex-1 flex-col items-center text-center">
        <motion.p
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-accent shadow-sm ring-2 ring-accent/15"
        >
          Pick a game. Make a memory.
        </motion.p>
        <motion.h1
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl"
        >
          Welcome to the{" "}
          <span className="bg-gradient-to-r from-accent via-accent-2 to-coral bg-clip-text text-transparent">
            Playground
          </span>
        </motion.h1>
        <motion.p
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 max-w-xl text-lg text-ink-muted sm:text-xl"
        >
          Soft colors, silly games, serious fun. Grab a seat — we saved you a
          sparkly card.
        </motion.p>

        <motion.div
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button variant="primary" onClick={() => router.push("/games")}>
            Play Games
          </Button>
          <Button
            variant="secondary"
            className="sm:min-w-[10rem]"
            onClick={() => router.push("/login")}
          >
            Sign in (demo)
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
