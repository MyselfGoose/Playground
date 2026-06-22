"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { contentExpand, revealCard, sectionEnter, truthReveal } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

const STEP_HEADINGS = {
  votes_summary: "Vote summary",
  per_lie: "Who wrote what?",
  truth: "The truth revealed",
  complete: "Round complete",
};

/** Backend phase durations in seconds */
const REVEAL_STEP_SECONDS = {
  votes_summary: 4,
  per_lie: 3,
  truth: 4,
  complete: 2,
};

/**
 * @param {string} step
 * @param {number} lieIndex
 * @param {Array<{ answerId: string, isTruth?: boolean, authorUserId?: string | null }>} answers
 * @param {string} answerId
 */
function isAnswerSpotlighted(step, lieIndex, answers, answerId) {
  const answer = answers.find((a) => a.answerId === answerId);
  if (!answer) return false;
  if (answer.isTruth) {
    return step === "truth" || step === "complete";
  }
  if (step === "votes_summary") return true;
  if (step === "per_lie") {
    const lies = answers.filter((a) => !a.isTruth);
    const lieIdx = lies.findIndex((a) => a.answerId === answerId);
    return lieIdx === lieIndex;
  }
  if (step === "truth" || step === "complete") return false;
  return false;
}

/**
 * @param {{
 *   answer: { answerId: string, text: string, isTruth?: boolean, authorUserId?: string | null, voteCount?: number, voters?: string[] },
 *   step: string,
 *   lieIndex: number,
 *   sortedAnswers: Array<{ answerId: string, isTruth?: boolean, authorUserId?: string | null }>,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   roundScores: Record<string, { totalRoundPoints?: number }>,
 *   reduce: boolean,
 * }} props
 */
function RevealAnswerCard({
  answer,
  step,
  lieIndex,
  sortedAnswers,
  players,
  roundScores,
  reduce,
}) {
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
    (step === "per_lie" && !spotlight && !isTruth) || (step === "truth" && !isTruth);

  const cardClasses = [
    "fibbage-card overflow-hidden",
    isTruth && (step === "truth" || step === "complete") ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
    dimmed ? "fibbage-card--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isTruthStep = isTruth && (step === "truth" || step === "complete");
  const cardMotion = isTruthStep ? truthReveal(reduce) : revealCard(reduce, spotlight);
  const expandMotion = contentExpand(reduce);

  const showAuthor = Boolean(author);
  const showVoters = voters.length > 0;
  const showVoteCount = typeof answer.voteCount === "number";
  const showDetails = showAuthor || showVoters || (step !== "votes_summary" && !author && !isTruth);

  return (
    <motion.div className={cardClasses} {...cardMotion}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex-1 font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
        {showVoteCount ? (
          <span className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]">
            {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isTruthStep ? (
        <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-truth)]">The truth</p>
      ) : null}

      <AnimatePresence initial={false}>
        {showDetails ? (
          <motion.div
            key="details"
            className="overflow-hidden"
            {...expandMotion}
          >
            {showAuthor ? (
              <div className="mt-3 flex items-center gap-2">
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
              </div>
            ) : null}

            {showVoters ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Fooled:</span>
                {voters.map((voter) => (
                  <div
                    key={voter.userId}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--fibbage-canvas)] px-2 py-1"
                  >
                    <Avatar
                      username={voter.username}
                      avatarUrl={voter.avatarUrl}
                      avatarEmoji={voter.avatarEmoji}
                      size="sm"
                    />
                    <span className="text-xs font-semibold">{voter.username}</span>
                  </div>
                ))}
              </div>
            ) : !author && !isTruth ? (
              <p className="mt-2 text-xs text-[var(--fibbage-text-muted)]">No votes</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function FibbageRevealStage() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const step = game?.reveal?.step ?? "votes_summary";
  const lieIndex = game?.reveal?.lieIndex ?? 0;
  const revealEndsAt = game?.reveal?.phaseEndsAt ?? game?.phaseEndsAt;
  const stepSeconds = REVEAL_STEP_SECONDS[step] ?? 4;
  const secondsRemaining = usePhaseCountdown(revealEndsAt, stepSeconds);

  const sortedAnswers = useMemo(() => {
    const answers = game?.answers ?? [];
    return [...answers].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }, [game?.answers]);

  const liesOnly = useMemo(() => sortedAnswers.filter((a) => !a.isTruth), [sortedAnswers]);
  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);

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
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {heading}
          </motion.p>
        </AnimatePresence>
        <h2 className="mt-2 text-xl font-black text-[var(--fibbage-text)]">{game?.prompt?.text}</h2>
      </motion.div>

      <div className="grid gap-3">
        {sortedAnswers.map((answer) => (
          <RevealAnswerCard
            key={answer.answerId}
            answer={answer}
            step={step}
            lieIndex={lieIndex}
            sortedAnswers={sortedAnswers}
            players={players}
            roundScores={roundScores}
            reduce={reduce}
          />
        ))}
      </div>

      {step === "votes_summary" ? (
        <motion.p
          className="text-center fibbage-body"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.28 }}
        >
          Authors and voters will be revealed next…
        </motion.p>
      ) : null}

      {step === "per_lie" && liesOnly.length > 0 ? (
        <p className="text-center fibbage-micro">
          Lie {lieIndex + 1} of {liesOnly.length}
        </p>
      ) : null}

      <FibbageTimerBar
        secondsRemaining={secondsRemaining}
        totalSeconds={stepSeconds}
        className="mx-auto"
      />
    </div>
  );
}
