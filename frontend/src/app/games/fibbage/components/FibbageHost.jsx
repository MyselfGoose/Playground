"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const HOST_LINES = {
  starting: [
    "Alright alright alright... let's lie with confidence.",
    "Warm up those fibbing fingers.",
    "Time to deceive with style.",
  ],
  prompt_reveal: [
    "Read it carefully. The truth is out there. So are your lies.",
    "Study this one. Your reputation depends on it.",
    "One blank. Infinite ways to embarrass yourself.",
  ],
  writing: [
    "Write something believable. Or unhinged. Both work.",
    "Channel your inner con artist.",
    "Make it plausible. Or absurd. Surprise me.",
  ],
  voting: [
    "One of these is real. The rest are your disgusting friends.",
    "Trust no one. Especially not the obvious answer.",
    "Pick wisely. Your dignity is at stake.",
  ],
  revealing: [
    "Drumroll please...",
    "The moment of truth. And lies.",
    "Let's see who got duped.",
  ],
  scoring: [
    "Points! Glorious, meaningless points!",
    "Numbers go up. Dopamine delivered.",
    "The scoreboard doesn't lie. Unlike all of you.",
  ],
  between_rounds: [
    "Catch your breath. More deception awaits.",
    "Ready for another round of betrayal?",
    "The lies continue shortly.",
  ],
  finished: [
    "We have a champion of deception.",
    "The ultimate fibber has been crowned.",
    "What a beautiful display of dishonesty.",
  ],
};

function pickLine(status) {
  const lines = HOST_LINES[status] ?? HOST_LINES.starting;
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * @param {{ status?: string }} props
 */
export function FibbageHost({ status }) {
  const line = useMemo(() => pickLine(status), [status]);

  return (
    <div className="px-4 pt-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          className="fibbage-host-strip mx-auto max-w-lg text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          {line}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
