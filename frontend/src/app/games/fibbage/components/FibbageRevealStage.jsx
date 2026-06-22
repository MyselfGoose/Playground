"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, revealCard, sectionEnter, truthReveal } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

const STEP_HEADINGS = {
  votes_summary: "Vote summary",
  per_lie: "Who wrote what?",
  truth: "The truth revealed",
  complete: "Round complete",
};

/**
 * @param {string} step
 * @param {number} lieIndex
 * @param {Array<{ answerId: string, isTruth?: boolean, authorUserId?: string | null }>} lies
 * @param {string} answerId
 */
function isAnswerSpotlighted(step, lieIndex, lies, answerId) {
  const answer = lies.find((a) => a.answerId === answerId);
  if (!answer) return false;
  if (answer.isTruth) {
    return step === "truth" || step === "complete";
  }
  if (step === "votes_summary") return true;
  if (step === "per_lie") {
    const lieIdx = lies.filter((a) => !a.isTruth).findIndex((a) => a.answerId === answerId);
    return lieIdx === lieIndex;
  }
  if (step === "truth" || step === "complete") return false;
  return false;
}

export function FibbageRevealStage() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const step = game?.reveal?.step ?? "votes_summary";
  const lieIndex = game?.reveal?.lieIndex ?? 0;
  const revealEndsAt = game?.reveal?.phaseEndsAt ?? game?.phaseEndsAt;
  const secondsRemaining = usePhaseCountdown(revealEndsAt, 4);
  const sortedAnswers = useMemo(() => {
    const answers = game?.answers ?? [];
    return [...answers].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }, [game?.answers]);

  const liesOnly = useMemo(() => sortedAnswers.filter((a) => !a.isTruth), [sortedAnswers]);
  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);
  const truthMotion = truthReveal(reduce);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <motion.div className="text-center" {...headerMotion}>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="fibbage-eyebrow"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            {heading}
          </motion.p>
        </AnimatePresence>
        <h2 className="mt-2 text-xl font-black text-[var(--fibbage-text)]">{game?.prompt?.text}</h2>
      </motion.div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {sortedAnswers.map((answer, index) => {
            const author = answer.authorUserId
              ? players.find((p) => p.userId === answer.authorUserId)
              : null;
            const voters = (answer.voters ?? [])
              .map((id) => players.find((p) => p.userId === id))
              .filter(Boolean);
            const isTruth = Boolean(answer.isTruth);
            const roundPoints =
              answer.authorUserId && roundScores[answer.authorUserId]
                ? roundScores[answer.authorUserId].totalRoundPoints
                : null;

            const spotlight = isAnswerSpotlighted(step, lieIndex, sortedAnswers, answer.answerId);
            const dimmed =
              step === "per_lie" && !spotlight && !isTruth
                ? true
                : step === "truth" && !isTruth
                  ? true
                  : false;

            const cardClasses = [
              "fibbage-card",
              isTruth && (step === "truth" || step === "complete") ? "fibbage-card--truth" : "",
              spotlight && !isTruth ? "fibbage-card--spotlight" : "",
              dimmed ? "fibbage-card--dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const motionProps = isTruth && (step === "truth" || step === "complete")
              ? truthMotion
              : {
                  ...revealCard(reduce, spotlight),
                  ...cardStagger(index, reduce),
                };

            const showAuthor = Boolean(author);
            const showVoters = voters.length > 0;
            const showVoteCount = typeof answer.voteCount === "number";

            return (
              <motion.div
                key={answer.answerId}
                layout={!reduce}
                className={cardClasses}
                {...motionProps}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="flex-1 font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
                  {showVoteCount ? (
                    <motion.span
                      className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]"
                      initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
                    </motion.span>
                  ) : null}
                </div>

                <AnimatePresence>
                  {showAuthor ? (
                    <motion.div
                      key="author"
                      className="mt-3 flex items-center gap-2"
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Avatar
                        username={author.username}
                        avatarUrl={author.avatarUrl}
                        avatarEmoji={author.avatarEmoji}
                        size="sm"
                      />
                      <span className="text-sm font-bold text-[var(--fibbage-accent)]">
                        {author.username} wrote this
                      </span>
                      {roundPoints ? (
                        <span className="text-sm font-bold text-[var(--fibbage-gold)]">+{roundPoints}</span>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {isTruth && (step === "truth" || step === "complete") ? (
                  <motion.p
                    className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-truth)]"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    The truth
                  </motion.p>
                ) : null}

                <AnimatePresence>
                  {showVoters ? (
                    <motion.div
                      key="voters"
                      className="mt-3 flex flex-wrap items-center gap-2"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Fooled:</span>
                      {voters.map((voter, voterIndex) => (
                        <motion.div
                          key={voter.userId}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--fibbage-canvas)] px-2 py-1"
                          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: voterIndex * 0.05 }}
                        >
                          <Avatar
                            username={voter.username}
                            avatarUrl={voter.avatarUrl}
                            avatarEmoji={voter.avatarEmoji}
                            size="sm"
                          />
                          <span className="text-xs font-semibold">{voter.username}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : step !== "votes_summary" && !author && !isTruth ? (
                    <motion.p
                      key="no-votes"
                      className="mt-2 text-xs text-[var(--fibbage-text-muted)]"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      No votes
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {step === "votes_summary" ? (
        <motion.p
          className="text-center fibbage-body"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Authors and voters will be revealed next…
        </motion.p>
      ) : null}

      {step === "per_lie" && liesOnly.length > 0 ? (
        <p className="text-center fibbage-micro">
          Lie {lieIndex + 1} of {liesOnly.length}
        </p>
      ) : null}

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={4} className="mx-auto" />
    </div>
  );
}
