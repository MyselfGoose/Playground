"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { useFibbageFeedback } from "../../../../lib/fibbage/FibbageFeedbackContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, sectionEnter } from "../../../../lib/fibbage/motion.js";
import { waitingForLabel } from "../fibbage-waiting.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbageButton } from "./FibbageButton.jsx";
import { FibbagePlayerStatus } from "./FibbagePlayerStatus.jsx";
import { FibbagePhaseSkipButton } from "./FibbagePhaseSkipButton.jsx";
import { FIBBAGE_LIE_MAX_LENGTH } from "../fibbage-shared.js";

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

  const allSubmitted =
    activePlayers.length > 0 && waitingFor.length === 0 && game?.status === "writing";
  const waitLabel = waitingForLabel(waitingFor);
  const charPct = (text.length / FIBBAGE_LIE_MAX_LENGTH) * 100;
  const promptText = game?.prompt?.text ?? "";

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
        flash("Lie submitted!", "fool");
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24 sm:pb-6">
      <motion.div className="fibbage-card text-center" {...panelMotion}>
        <p className="fibbage-body">Fill in the blank with a convincing lie</p>
        <motion.p
          className="mt-3 fibbage-prompt-hero"
          layoutId="fibbage-prompt"
          transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {promptText}
        </motion.p>
      </motion.div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div key="waiting" className="fibbage-card text-center" {...swapMotion}>
            <p className="font-bold text-[var(--fibbage-accent-glow)]">Lie submitted!</p>
            {waitLabel ? (
              <p className="mt-2 fibbage-body">{waitLabel}</p>
            ) : null}
            {waitingFor.length > 0 ? (
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
            ) : null}
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
              maxLength={FIBBAGE_LIE_MAX_LENGTH}
              rows={3}
              disabled={!canSubmit || pending}
              placeholder="Make it believable…"
              className="fibbage-input fibbage-input--creative"
            />
            <div className="fibbage-char-meter" aria-hidden>
              <div className="fibbage-char-meter__fill" style={{ width: `${charPct}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="fibbage-micro">{text.length}/{FIBBAGE_LIE_MAX_LENGTH}</span>
              <FibbageButton
                className={text.trim() ? "rounded-full" : ""}
                disabled={!canSubmit || !text.trim()}
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

      <div className="flex items-end justify-between gap-4">
        <FibbagePhaseSkipButton phase="writing" />
        <FibbageTimerBar
          secondsRemaining={secondsRemaining}
          totalSeconds={writingSeconds}
          accelerating={allSubmitted}
          urgent={room?.settings?.presetId === "blitz"}
          className="flex-1 max-w-md"
        />
      </div>

      <p className="text-center fibbage-micro" aria-live="polite">
        {submittedUserIds.length} of {activePlayers.length} submitted
      </p>
    </div>
  );
}
