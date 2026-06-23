"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { useFibbageFeedback } from "../../../../lib/fibbage/FibbageFeedbackContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, sectionEnter } from "../../../../lib/fibbage/motion.js";
import { waitingForLabel } from "../fibbage-waiting.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbagePlayerStatus } from "./FibbagePlayerStatus.jsx";
import { FibbagePhaseSkipButton } from "./FibbagePhaseSkipButton.jsx";
import { Modal } from "../../../../components/ui/Modal.jsx";
import { FibbageButton } from "./FibbageButton.jsx";

export function FibbageVotingGrid() {
  const reduce = useReducedMotion();
  const { room, castVote } = useFibbage();
  const { flash } = useFibbageFeedback();
  const game = room?.game;
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmAnswerId, setConfirmAnswerId] = useState(/** @type {string | null} */ (null));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const votingSeconds = room?.settings?.votingSeconds ?? 45;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, votingSeconds);
  const answers = game?.answers ?? [];
  const canVote = Boolean(room?.permissions?.canVote);
  const hasVoted = Boolean(game?.viewerVote);
  const votedUserIds = game?.votedUserIds ?? [];
  const ownAnswerId = room?.permissions?.ownAnswerId ?? null;
  const promptText = game?.prompt?.text ?? "";

  const activePlayers = useMemo(
    () => room?.players?.filter((p) => p.connected !== false) ?? [],
    [room?.players],
  );

  const waitingFor = useMemo(
    () => activePlayers.filter((p) => !votedUserIds.includes(p.userId)),
    [activePlayers, votedUserIds],
  );

  const allVoted = activePlayers.length > 0 && waitingFor.length === 0 && game?.status === "voting";
  const waitLabel = waitingForLabel(waitingFor);

  const castVoteFor = useCallback(
    async (answerId) => {
      if (!canVote || pendingId || answerId === ownAnswerId) return;
      setPendingId(answerId);
      setError(null);
      try {
        const result = await castVote(answerId);
        if (result && !result.ok) {
          setError(result.error?.message ?? "Could not cast vote.");
        } else {
          flash("Vote cast!", "vote");
        }
      } catch {
        setError("Could not cast vote.");
      } finally {
        setPendingId(null);
        setConfirmAnswerId(null);
      }
    },
    [canVote, castVote, ownAnswerId, pendingId, flash],
  );

  const handleVoteClick = useCallback(
    (answerId) => {
      if (!canVote || pendingId || answerId === ownAnswerId || hasVoted) return;
      if (isMobile) {
        setConfirmAnswerId(answerId);
      } else {
        void castVoteFor(answerId);
      }
    },
    [canVote, pendingId, ownAnswerId, hasVoted, isMobile, castVoteFor],
  );

  const headerMotion = sectionEnter(reduce);
  const waitingMotion = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.22 },
      };

  const confirmAnswer = answers.find((a) => a.answerId === confirmAnswerId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24 sm:pb-6">
      <motion.div className="fibbage-card text-center" {...headerMotion}>
        <p className="fibbage-body">Which answer is the truth?</p>
        <motion.p
          className="mt-2 fibbage-prompt-hero"
          layoutId="fibbage-prompt"
          transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {promptText}
        </motion.p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        {answers.map((answer, index) => {
          const isOwn = answer.answerId === ownAnswerId;
          const isSelected = game?.viewerVote === answer.answerId;
          const isPending = pendingId === answer.answerId;
          const disabled = !canVote || pendingId !== null || isOwn || hasVoted;

          return (
            <motion.button
              key={answer.answerId}
              type="button"
              disabled={disabled}
              onClick={() => handleVoteClick(answer.answerId)}
              aria-pressed={isSelected}
              className={`fibbage-card relative text-left ${
                isSelected ? "fibbage-card--selected" : ""
              } ${isOwn ? "fibbage-card--own-lie" : ""}`}
              {...cardStagger(index, reduce)}
              whileHover={reduce || disabled ? undefined : { scale: 1.02, y: -2 }}
              whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
            >
              <p className="font-semibold text-[var(--fibbage-text)] pr-8">{answer.text}</p>
              {isOwn ? (
                <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-accent)]">
                  Your lie — can&apos;t vote
                </p>
              ) : null}
              {isSelected ? (
                <motion.span
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fibbage-gold)] text-[var(--fibbage-canvas)]"
                  initial={reduce ? false : { scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.span>
              ) : null}
              {isPending ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--fibbage-canvas)]/50 text-sm font-bold text-[var(--fibbage-accent-glow)]">
                  Voting…
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {hasVoted ? (
          <motion.div key="voted-wait" className="fibbage-card text-center" {...waitingMotion}>
            <p className="font-bold text-[var(--fibbage-accent-glow)]">Vote cast!</p>
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
                      isSubmitted
                      isVoted={false}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {error ? (
          <motion.p
            className="text-center text-sm font-semibold text-[var(--fibbage-lie)]"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div className="flex items-end justify-between gap-4">
        <FibbagePhaseSkipButton phase="voting" />
        <FibbageTimerBar
          secondsRemaining={secondsRemaining}
          totalSeconds={votingSeconds}
          accelerating={allVoted}
          urgent={room?.settings?.presetId === "blitz"}
          className="flex-1 max-w-md"
        />
      </div>

      <p className="text-center fibbage-micro" aria-live="polite">
        {votedUserIds.length} of {activePlayers.length} voted
      </p>

      <Modal
        open={Boolean(confirmAnswerId)}
        onClose={() => setConfirmAnswerId(null)}
        title="Lock in your vote?"
        description="You can't change your vote after confirming."
        size="sm"
        showCloseButton={false}
        panelClassName="fibbage-card border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)]"
      >
        {confirmAnswer ? (
          <p className="mb-4 text-sm font-semibold text-[var(--fibbage-text)]">
            &ldquo;{confirmAnswer.text}&rdquo;
          </p>
        ) : null}
        <div className="flex gap-3">
          <FibbageButton variant="secondary" className="flex-1" onClick={() => setConfirmAnswerId(null)}>
            Cancel
          </FibbageButton>
          <FibbageButton
            className="flex-1"
            pending={pendingId !== null}
            onClick={() => confirmAnswerId && void castVoteFor(confirmAnswerId)}
          >
            Confirm vote
          </FibbageButton>
        </div>
      </Modal>
    </div>
  );
}
