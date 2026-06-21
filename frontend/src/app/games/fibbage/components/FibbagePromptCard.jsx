"use client";

import { motion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

function renderPromptText(text) {
  const parts = String(text ?? "").split(/_{2,}/);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 ? <span className="fibbage-prompt-blank">&nbsp;</span> : null}
    </span>
  ));
}

export function FibbagePromptReveal() {
  const { room } = useFibbage();
  const game = room?.game;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, 4);

  return (
    <motion.div
      className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--fibbage-accent)]">
        {game?.status === "starting" ? "Round starting" : "The prompt is"}
      </p>
      <h2 className="text-2xl font-black leading-relaxed text-[var(--fibbage-text)] sm:text-3xl">
        {renderPromptText(game?.prompt?.text)}
      </h2>
      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={4} />
    </motion.div>
  );
}
