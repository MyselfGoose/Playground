"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import {
  revealBeat,
  revealCard,
  scorePop,
  sectionEnter,
  truthReveal,
} from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const STEP_HEADINGS = {
  votes_summary: "Vote summary",
  per_answer: "Who wrote what?",
};

const SUB_STEP_ORDER = { highlight: 0, author: 1, voters: 2, points: 3 };

/**
 * @param {string | null | undefined} current
 * @param {string} target
 */
function subStepAtLeast(current, target) {
  const currentRank = current ? (SUB_STEP_ORDER[current] ?? -1) : -1;
  return currentRank >= (SUB_STEP_ORDER[target] ?? 0);
}

/**
 * @param {string | { userId?: string }} entry
 */
function voterId(entry) {
  return typeof entry === "string" ? entry : entry?.userId ?? "";
}

/**
 * @param {{ authorUserId?: string | null, voters?: Array<string | { userId?: string }> }} answer
 * @param {Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>} players
 * @param {Record<string, { fooled?: Array<{ voterUserId: string }> }>} roundScores
 */
function resolveVoters(answer, players, roundScores) {
  const playerById = new Map(players.map((p) => [p.userId, p]));
  const ids = new Set((answer.voters ?? []).map(voterId).filter(Boolean));

  if (ids.size === 0 && answer.authorUserId && roundScores[answer.authorUserId]?.fooled) {
    for (const entry of roundScores[answer.authorUserId].fooled ?? []) {
      if (entry.voterUserId) ids.add(entry.voterUserId);
    }
  }

  return [...ids]
    .map((id) => playerById.get(id) ?? { userId: id, username: "Player", avatarUrl: null, avatarEmoji: null })
    .filter((p) => p.userId);
}

/**
 * @param {string} authorUserId
 * @param {Array<{ userId: string }>} voters
 * @param {Record<string, { fooled?: Array<{ voterUserId: string, points: number }> }>} roundScores
 */
function getLieFoolPoints(authorUserId, voters, roundScores) {
  if (!authorUserId || !roundScores[authorUserId]) return 0;
  const voterIds = new Set(voters.map((v) => v.userId));
  return (roundScores[authorUserId].fooled ?? [])
    .filter((f) => voterIds.has(f.voterUserId))
    .reduce((sum, f) => sum + f.points, 0);
}

/**
 * @param {{
 *   answer: { answerId: string, text: string, isTruth?: boolean, authorUserId?: string | null, voteCount?: number, voters?: string[] },
 *   answerIndex: number,
 *   step: string,
 *   subStep: string | null,
 *   currentAnswerIndex: number,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   roundScores: Record<string, { totalRoundPoints?: number, fooled?: Array<{ voterUserId: string, points: number }>, truthPick?: { points: number } }>,
 *   reduce: boolean,
 * }} props
 */
function RevealAnswerCard({
  answer,
  answerIndex,
  step,
  subStep,
  currentAnswerIndex,
  players,
  roundScores,
  reduce,
}) {
  const author = answer.authorUserId
    ? players.find((p) => p.userId === answer.authorUserId) ?? {
        userId: answer.authorUserId,
        username: "Player",
        avatarUrl: null,
        avatarEmoji: null,
      }
    : null;
  const voters = resolveVoters(answer, players, roundScores);
  const voterCount = Math.max(answer.voteCount ?? 0, voters.length);
  const isTruth = Boolean(answer.isTruth);

  const isCurrent = step === "per_answer" && answerIndex === currentAnswerIndex;
  const isFullyRevealed = step === "per_answer" && answerIndex < currentAnswerIndex;
  const spotlight = step === "votes_summary" || isCurrent;
  const dimmed = step === "per_answer" && answerIndex > currentAnswerIndex;

  const effectiveSubStep =
    reduce && isCurrent ? "points" : subStep;

  const lieFoolPoints =
    author && voters.length > 0 ? getLieFoolPoints(author.userId, voters, roundScores) : 0;

  const showAuthor =
    Boolean(author) &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "author")));

  const showVoters =
    voters.length > 0 &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showNoFooled =
    !isTruth &&
    showAuthor &&
    voterCount === 0 &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showLiePoints =
    lieFoolPoints > 0 &&
    showAuthor &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const showNoTruthFinders =
    isTruth &&
    (isFullyRevealed || isCurrent) &&
    voterCount === 0 &&
    (isFullyRevealed || subStepAtLeast(effectiveSubStep, "voters"));

  const showTruthPoints =
    isTruth &&
    voters.some((v) => (roundScores[v.userId]?.truthPick?.points ?? 0) > 0) &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const cardClasses = [
    "fibbage-card fibbage-reveal-card overflow-hidden",
    isTruth && (spotlight || isFullyRevealed) ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
    dimmed ? "fibbage-card--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardMotion =
    isTruth && (spotlight || isFullyRevealed) ? truthReveal(reduce) : revealCard(reduce);
  const beatMotion = revealBeat(reduce);
  const pointsMotion = scorePop(reduce);
  const showVoteCount = typeof answer.voteCount === "number";

  return (
    <motion.div layout={false} className={cardClasses} {...cardMotion}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex-1 font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
        {showVoteCount ? (
          <span className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]">
            {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isTruth && (spotlight || isFullyRevealed) ? (
        <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-truth)]">The truth</p>
      ) : null}

      {showAuthor ? (
        <motion.div key={`author-${answer.answerId}`} className="mt-3 flex items-center gap-2" {...beatMotion}>
          <Avatar
            username={author.username}
            avatarUrl={author.avatarUrl}
            avatarEmoji={author.avatarEmoji}
            size="sm"
          />
          <span className="text-sm font-bold text-[var(--fibbage-accent)]">
            {author.username} wrote this
          </span>
        </motion.div>
      ) : null}

      {showVoters ? (
        <motion.div key={`voters-${answer.answerId}`} className="mt-3" {...beatMotion}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">
              {isTruth ? "Found the truth:" : "Fooled:"}
            </span>
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
        </motion.div>
      ) : showNoFooled ? (
        <motion.p
          key={`no-fools-${answer.answerId}`}
          className="mt-3 text-sm text-[var(--fibbage-text-muted)]"
          {...beatMotion}
        >
          Nobody was fooled
        </motion.p>
      ) : showNoTruthFinders ? (
        <motion.p
          key={`no-truth-${answer.answerId}`}
          className="mt-3 text-sm text-[var(--fibbage-text-muted)]"
          {...beatMotion}
        >
          Nobody found the truth
        </motion.p>
      ) : null}

      {showLiePoints ? (
        <motion.div
          key={`lie-points-${answer.answerId}`}
          className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-2"
          {...pointsMotion}
        >
          <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Points earned</span>
          <span className="text-lg font-black text-[var(--fibbage-gold)]">+{lieFoolPoints}</span>
        </motion.div>
      ) : null}

      {showTruthPoints ? (
        <motion.div
          key={`truth-points-${answer.answerId}`}
          className="mt-3 flex flex-col gap-2"
          {...pointsMotion}
        >
          {voters.map((voter) => {
            const pts = roundScores[voter.userId]?.truthPick?.points ?? 0;
            if (pts <= 0) return null;
            return (
              <div
                key={voter.userId}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-2"
              >
                <span className="text-xs font-semibold">{voter.username}</span>
                <span className="text-sm font-black text-[var(--fibbage-gold)]">+{pts}</span>
              </div>
            );
          })}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export function FibbageRevealStage() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const step = game?.reveal?.step ?? "votes_summary";
  const subStep = game?.reveal?.subStep ?? null;
  const currentAnswerIndex = game?.reveal?.answerIndex ?? 0;

  const answersInRevealOrder = useMemo(() => game?.answers ?? [], [game?.answers]);

  const displayAnswers = useMemo(() => {
    if (step === "votes_summary") {
      return [...answersInRevealOrder].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
    }
    return answersInRevealOrder;
  }, [answersInRevealOrder, step]);

  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <motion.div className="text-center" {...headerMotion}>
        <motion.p
          key={step}
          className="fibbage-eyebrow"
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {heading}
        </motion.p>
        <h2 className="mt-2 text-xl font-black text-[var(--fibbage-text)]">{game?.prompt?.text}</h2>
      </motion.div>

      <div className="grid gap-3">
        {displayAnswers.map((answer) => {
          const answerIndex = answersInRevealOrder.findIndex((a) => a.answerId === answer.answerId);

          return (
            <RevealAnswerCard
              key={answer.answerId}
              answer={answer}
              answerIndex={answerIndex >= 0 ? answerIndex : 0}
              step={step}
              subStep={subStep}
              currentAnswerIndex={currentAnswerIndex}
              players={players}
              roundScores={roundScores}
              reduce={reduce}
            />
          );
        })}
      </div>

      {step === "votes_summary" ? (
        <motion.p
          className="text-center fibbage-body"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.24 }}
        >
          Authors and voters will be revealed next…
        </motion.p>
      ) : null}

      {step === "per_answer" && answersInRevealOrder.length > 0 ? (
        <p className="text-center fibbage-micro">
          Answer {currentAnswerIndex + 1} of {answersInRevealOrder.length}
        </p>
      ) : null}
    </div>
  );
}
