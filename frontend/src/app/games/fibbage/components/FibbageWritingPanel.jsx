"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { useFibbageFeedback } from "../../../../lib/fibbage/FibbageFeedbackContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { sectionEnter } from "../../../../lib/fibbage/motion.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbageButton } from "./FibbageButton.jsx";
import { FibbagePlayerStatus } from "./FibbagePlayerStatus.jsx";

export function FibbageWritingPanel() {
  const reduce = useReducedMotion();
  const { room, submitLie } = useFibbage();
  const { flash } = useFibbageFeedback();
  const game = room?.game;
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const writingSeconds = room?.settings?.writingSeconds ?? 90;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, writingSeconds);
  const canSubmit = Boolean(room?.permissions?.canSubmitLie);
  const submitted = Boolean(room?.permissions?.ownSubmissionLocked);
  const submittedUserIds = game?.submittedUserIds ?? [];

  const activePlayers = useMemo(
    () => room?.players?.filter((p) => p.connected !== false) ?? [],
    [room?.players],
  );

  const waitingFor = useMemo(
    () => activePlayers.filter((p) => !submittedUserIds.includes(p.userId)),
    [activePlayers, submittedUserIds],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || pending || !text.trim()) return;
    setPending(true);
    setError(null);
    try {
      const result = await submitLie(text.trim());
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not submit lie.");
      } else {
        setText("");
        flash("Lie submitted!");
      }
    } catch {
      setError("Could not submit lie.");
    } finally {
      setPending(false);
    }
  }, [canSubmit, pending, submitLie, text, flash]);

  const panelMotion = sectionEnter(reduce);
  const swapMotion = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.22 },
      };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <motion.div className="fibbage-card text-center" {...panelMotion}>
        <p className="fibbage-body">Fill in the blank with a convincing lie</p>
        <p className="mt-3 text-xl font-bold leading-relaxed text-[var(--fibbage-text)]">
          {game?.prompt?.text}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div key="waiting" className="fibbage-card text-center" {...swapMotion}>
            <p className="font-bold text-[var(--fibbage-accent)]">Lie submitted!</p>
            <p className="mt-2 fibbage-body">
              Waiting for {waitingFor.length} player{waitingFor.length === 1 ? "" : "s"}…
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <AnimatePresence>
                {waitingFor.map((player) => (
                  <FibbagePlayerStatus
                    key={player.userId}
                    player={player}
                    isSubmitted={false}
                    isVoted={false}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" className="fibbage-card space-y-4" {...swapMotion}>
            <label className="block text-sm font-semibold text-[var(--fibbage-text)]" htmlFor="fibbage-lie">
              Your lie
            </label>
            <textarea
              id="fibbage-lie"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={120}
              rows={3}
              disabled={!canSubmit || pending}
              placeholder="Make it believable…"
              className="fibbage-input"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="fibbage-micro">{text.length}/120</span>
              <FibbageButton
                disabled={!canSubmit || text.trim().length < 3}
                pending={pending}
                onClick={() => void handleSubmit()}
              >
                {pending ? "Submitting…" : "Submit lie"}
              </FibbageButton>
            </div>
            <AnimatePresence>
              {error ? (
                <motion.p
                  className="text-sm font-semibold text-[var(--fibbage-lie)]"
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={writingSeconds} className="mx-auto" />

      <p className="text-center fibbage-micro" aria-live="polite">
        {submittedUserIds.length} of {activePlayers.length} submitted
      </p>
    </div>
  );
}
