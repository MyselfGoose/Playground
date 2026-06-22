"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { sectionEnter } from "../../../../lib/fibbage/motion.js";
import { COUNTDOWN_STEPS, gameFeelMotion } from "../../../../components/game-feel/gameFeelMotion.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

function renderPromptText(text, animateBlank = false) {
  const parts = String(text ?? "").split(/_{2,}/);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 ? (
        <span className={animateBlank ? "fibbage-prompt-blank" : "fibbage-prompt-blank"}>&nbsp;</span>
      ) : null}
    </span>
  ));
}

export function FibbagePromptReveal() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const isStarting = game?.status === "starting";
  const totalSeconds = isStarting ? 3 : 4;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, totalSeconds);
  const sectionMotion = sectionEnter(reduce);

  const countdownIndex =
    isStarting && !reduce
      ? Math.min(
          COUNTDOWN_STEPS.length - 1,
          Math.max(0, totalSeconds - secondsRemaining),
        )
      : COUNTDOWN_STEPS.length - 1;
  const countdownLabel = COUNTDOWN_STEPS[countdownIndex] ?? "GO";

  return (
    <motion.div
      className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center"
      {...sectionMotion}
    >
      <p className="fibbage-eyebrow">
        {isStarting ? "Round starting" : "The prompt is"}
      </p>

      {isStarting ? (
        <AnimatePresence mode="wait">
          <motion.p
            key={reduce ? "go" : countdownLabel}
            className="text-[min(20vw,5rem)] font-black tabular-nums leading-none text-[var(--fibbage-accent-glow)]"
            {...(reduce ? gameFeelMotion.countdownStepReduced : gameFeelMotion.countdownStep)}
          >
            {reduce ? "GO" : countdownLabel}
          </motion.p>
        </AnimatePresence>
      ) : (
        <motion.h2
          className="fibbage-display leading-relaxed"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          {renderPromptText(game?.prompt?.text, true)}
        </motion.h2>
      )}

      <FibbageTimerBar
        secondsRemaining={secondsRemaining}
        totalSeconds={totalSeconds}
        className="mx-auto"
      />
    </motion.div>
  );
}
