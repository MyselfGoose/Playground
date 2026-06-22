"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { useFibbageFeedback } from "../../../../lib/fibbage/FibbageFeedbackContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, sectionEnter } from "../../../../lib/fibbage/motion.js";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbagePlayerStatus } from "./FibbagePlayerStatus.jsx";

export function FibbageVotingGrid() {
  const reduce = useReducedMotion();
  const { room, castVote } = useFibbage();
  const { flash } = useFibbageFeedback();
  const game = room?.game;
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);

  const votingSeconds = room?.settings?.votingSeconds ?? 45;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, votingSeconds);
  const answers = game?.answers ?? [];
  const canVote = Boolean(room?.permissions?.canVote);
  const hasVoted = Boolean(game?.viewerVote);
  const votedUserIds = game?.votedUserIds ?? [];
  const ownAnswerId = room?.permissions?.ownAnswerId ?? null;

  const activePlayers = useMemo(
    () => room?.players?.filter((p) => p.connected !== false) ?? [],
    [room?.players],
  );

  const waitingFor = useMemo(
    () => activePlayers.filter((p) => !votedUserIds.includes(p.userId)),
    [activePlayers, votedUserIds],
  );

  const handleVote = useCallback(
    async (answerId) => {
      if (!canVote || pendingId || answerId === ownAnswerId) return;
      setPendingId(answerId);
      setError(null);
      try {
        const result = await castVote(answerId);
        if (result && !result.ok) {
          setError(result.error?.message ?? "Could not cast vote.");
        } else {
          flash("Vote cast!");
        }
      } catch {
        setError("Could not cast vote.");
      } finally {
        setPendingId(null);
      }
    },
    [canVote, castVote, ownAnswerId, pendingId, flash],
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <motion.div className="fibbage-card text-center" {...headerMotion}>
        <p className="fibbage-body">Which answer is the truth?</p>
        <p className="mt-2 text-lg font-bold text-[var(--fibbage-text)]">{game?.prompt?.text}</p>
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
              onClick={() => void handleVote(answer.answerId)}
              className={`fibbage-card relative text-left ${
                isSelected ? "fibbage-card--selected" : ""
              } ${isOwn ? "fibbage-card--disabled" : ""}`}
              {...cardStagger(index, reduce)}
              whileHover={reduce || disabled ? undefined : { scale: 1.02 }}
              whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
            >
              <p className="font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
              {isOwn ? (
                <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-accent)]">
                  Your lie — can&apos;t vote
                </p>
              ) : null}
              {isSelected ? (
                <motion.span
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fibbage-gold)] text-[var(--fibbage-canvas)]"
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.span>
              ) : null}
              {isPending ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--fibbage-canvas)]/40 text-sm font-bold text-[var(--fibbage-accent)]">
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
            <p className="font-bold text-[var(--fibbage-accent)]">Vote cast!</p>
            <p className="mt-2 fibbage-body">
              Waiting for {waitingFor.length} player{waitingFor.length === 1 ? "" : "s"}…
            </p>
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

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={votingSeconds} className="mx-auto" />

      <p className="text-center fibbage-micro" aria-live="polite">
        {votedUserIds.length} of {activePlayers.length} voted
      </p>
    </div>
  );
}
