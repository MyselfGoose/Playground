"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../components/Button.jsx";

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
      {/* Animated background elements */}
      {!reduce ? (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-gradient-to-br from-accent-purple/20 to-accent-pink/20 blur-3xl"
            animate={{ 
              y: [0, -20, 0],
              x: [0, 15, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-gradient-to-br from-accent-mint/20 to-accent-lemon/20 blur-3xl"
            animate={{ 
              y: [0, 25, 0],
              x: [0, -20, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-20 left-1/4 h-96 w-96 rounded-full bg-gradient-to-br from-primary/10 to-accent-pink/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}

      <motion.div
        className="relative z-[1] mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center text-center gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Badge */}
        <motion.div variants={itemVariants}>
          <motion.p
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-lemon to-accent-pink px-5 py-2 text-sm font-extrabold uppercase tracking-widest text-foreground shadow-[var(--shadow-play)] ring-2 ring-white/40"
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
          >
            <span className="text-lg">🎮</span>
            Pick a game. Make a memory.
          </motion.p>
        </motion.div>

        {/* Main heading */}
        <motion.div variants={itemVariants}>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight tracking-tighter text-foreground">
            Welcome to the{" "}
            <span className="bg-gradient-to-r from-primary via-accent-pink to-accent-purple bg-clip-text text-transparent animate-pulse">
              Playground
            </span>
          </h1>
        </motion.div>

        {/* Subheading */}
        <motion.div variants={itemVariants}>
          <p className="text-lg sm:text-xl text-foreground/70 max-w-2xl leading-relaxed">
            A colorful realm of games, laughter, and unforgettable moments with friends. 
            Ready to dive in?
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-4"
        >
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
          >
            <Button 
              variant="primary" 
              className="px-8 py-4 text-lg font-extrabold"
              onClick={() => router.push("/games")}
            >
              🎯 Play Games
            </Button>
          </motion.div>
          
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
          >
            <Button
              variant="secondary"
              className="px-8 py-4 text-lg font-extrabold"
              onClick={() => router.push("/login")}
            >
              ✨ Sign In
            </Button>
          </motion.div>
        </motion.div>

        {/* Feature callout */}
        <motion.div
          variants={itemVariants}
          className="pt-8 mt-8 border-t-2 border-muted-bright/30"
        >
          <p className="text-sm font-bold text-muted uppercase tracking-wider mb-4">What you&apos;ll find here</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { emoji: "⌨️", label: "Typing Races" },
              { emoji: "🌍", label: "NPAT" },
              { emoji: "🎯", label: "Taboo" },
            ].map(({ emoji, label }) => (
              <motion.div
                key={label}
                whileHover={reduce ? undefined : { y: -4 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted-bright/30 ring-1 ring-muted-bright/50"
              >
                <span className="text-xl">{emoji}</span>
                <span className="font-bold text-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
