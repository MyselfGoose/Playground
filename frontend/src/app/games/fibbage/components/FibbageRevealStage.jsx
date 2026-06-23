"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import {
  revealBeat,
  revealCard,
  scorePop,
  sectionEnter,
  truthReveal,
} from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

const STEP_HEADINGS = {
  votes_summary: "Vote summary",
  per_lie: "Who wrote what?",
  truth: "The truth revealed",
  complete: "Round complete",
};

/** Fallback when server step duration is unknown */
const REVEAL_STEP_SECONDS_FALLBACK = {
  votes_summary: 4,
  per_lie: 4,
  truth: 3,
  complete: 2,
};

const LIE_SUB_STEP_ORDER = { highlight: 0, author: 1, voters: 2, points: 3 };
const TRUTH_SUB_STEP_ORDER = { highlight: 0, voters: 1, points: 2 };

/**
 * @param {Record<string, number>} order
 * @param {string | null | undefined} current
 * @param {string} target
 */
function subStepAtLeast(order, current, target) {
  const currentRank = current ? (order[current] ?? -1) : -1;
  const targetRank = order[target] ?? 0;
  return currentRank >= targetRank;
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
 * @param {string} answerId
 * @param {Array<{ answerId: string }>} liesInRevealOrder
 */
function getLieIndex(answerId, liesInRevealOrder) {
  return liesInRevealOrder.findIndex((a) => a.answerId === answerId);
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
 *   step: string,
 *   subStep: string | null,
 *   lieIndex: number,
 *   liesInRevealOrder: Array<{ answerId: string, isTruth?: boolean }>,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   roundScores: Record<string, { totalRoundPoints?: number, fooled?: Array<{ voterUserId: string, points: number }>, truthPick?: { points: number } }>,
 *   reduce: boolean,
 *   variant?: 'full' | 'chip',
 * }} props
 */
function RevealAnswerCard({
  answer,
  step,
  subStep,
  lieIndex,
  liesInRevealOrder,
  players,
  roundScores,
  reduce,
  variant = "full",
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
  const lieIdx = isTruth ? -1 : getLieIndex(answer.answerId, liesInRevealOrder);
  const isCurrentLie = step === "per_lie" && lieIdx === lieIndex;
  const lieFullyRevealed =
    !isTruth &&
    lieIdx >= 0 &&
    ((step === "per_lie" && lieIdx < lieIndex) || step === "truth" || step === "complete");
  const isTruthStep = isTruth && (step === "truth" || step === "complete");
  const isCurrentTruth = step === "truth" && isTruth;

  const effectiveLieSubStep =
    reduce && isCurrentLie ? "points" : step === "complete" ? "points" : subStep;
  const effectiveTruthSubStep =
    reduce && isCurrentTruth ? "points" : step === "complete" ? "points" : subStep;

  const lieFoolPoints =
    author && voters.length > 0 ? getLieFoolPoints(author.userId, voters, roundScores) : 0;

  const showAuthor =
    Boolean(author) &&
    (lieFullyRevealed ||
      (isCurrentLie && subStepAtLeast(LIE_SUB_STEP_ORDER, effectiveLieSubStep, "author")) ||
      isTruthStep);

  const showVoters =
    voters.length > 0 &&
    (lieFullyRevealed ||
      (step === "complete" && isTruth) ||
      (isCurrentLie && subStepAtLeast(LIE_SUB_STEP_ORDER, effectiveLieSubStep, "voters")) ||
      (isCurrentTruth && subStepAtLeast(TRUTH_SUB_STEP_ORDER, effectiveTruthSubStep, "voters")) ||
      (isTruthStep && step === "complete"));

  const showNoFooled =
    !isTruth &&
    showAuthor &&
    voterCount === 0 &&
    (lieFullyRevealed ||
      (isCurrentLie && subStepAtLeast(LIE_SUB_STEP_ORDER, effectiveLieSubStep, "voters")));

  const showLiePoints =
    lieFoolPoints > 0 &&
    showAuthor &&
    (lieFullyRevealed ||
      (isCurrentLie && subStepAtLeast(LIE_SUB_STEP_ORDER, effectiveLieSubStep, "points")));

  const showNoTruthFinders =
    isTruth &&
    (isCurrentTruth || step === "complete") &&
    voterCount === 0 &&
    (step === "complete" ||
      subStepAtLeast(TRUTH_SUB_STEP_ORDER, effectiveTruthSubStep, "voters"));

  const showTruthPoints =
    isTruth &&
    voters.some((v) => (roundScores[v.userId]?.truthPick?.points ?? 0) > 0) &&
    (step === "complete" ||
      (isCurrentTruth && subStepAtLeast(TRUTH_SUB_STEP_ORDER, effectiveTruthSubStep, "points")));

  const spotlight =
    isCurrentLie ||
    isTruthStep ||
    step === "votes_summary" ||
    step === "complete";

  const showVoteCount =
    variant === "full" &&
    typeof answer.voteCount === "number" &&
    (step === "votes_summary" || isCurrentLie || isTruthStep || lieFullyRevealed);

  if (variant === "chip") {
    return (
      <div className="fibbage-reveal-chip flex items-center gap-2 rounded-xl bg-[var(--fibbage-canvas-light)] px-3 py-2">
        <span className="max-w-[12rem] truncate text-sm font-semibold text-[var(--fibbage-text-muted)]">
          {answer.text}
        </span>
        {author ? (
          <span className="text-xs font-bold text-[var(--fibbage-accent)]">{author.username}</span>
        ) : null}
        {typeof answer.voteCount === "number" && answer.voteCount > 0 ? (
          <span className="ml-auto text-xs font-bold text-[var(--fibbage-gold)]">
            {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    );
  }

  const cardClasses = [
    "fibbage-card overflow-hidden",
    isTruthStep ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardMotion = isTruthStep ? truthReveal(reduce) : revealCard(reduce, spotlight);
  const beatMotion = revealBeat(reduce);
  const pointsMotion = scorePop(reduce);

  return (
    <motion.div className={cardClasses} {...cardMotion}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex-1 text-lg font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
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
        {showAuthor ? (
          <motion.div key="author" className="mt-4 flex items-center gap-2" {...beatMotion}>
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
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showVoters ? (
          <motion.div key="voters" className="mt-4" {...beatMotion}>
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
          <motion.p key="no-fools" className="mt-4 text-sm text-[var(--fibbage-text-muted)]" {...beatMotion}>
            Nobody was fooled
          </motion.p>
        ) : showNoTruthFinders ? (
          <motion.p
            key="no-truth-finders"
            className="mt-4 text-sm text-[var(--fibbage-text-muted)]"
            {...beatMotion}
          >
            Nobody found the truth
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showLiePoints ? (
          <motion.div
            key="lie-points"
            className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-2"
            {...pointsMotion}
          >
            <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Points earned</span>
            <span className="text-lg font-black text-[var(--fibbage-gold)]">+{lieFoolPoints}</span>
          </motion.div>
        ) : null}

        {showTruthPoints ? (
          <motion.div key="truth-points" className="mt-4 flex flex-col gap-2" {...pointsMotion}>
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
  const subStep = game?.reveal?.subStep ?? null;
  const lieIndex = game?.reveal?.lieIndex ?? 0;
  const revealEndsAt = game?.reveal?.phaseEndsAt ?? game?.phaseEndsAt;
  const stepSecondsFallback = REVEAL_STEP_SECONDS_FALLBACK[step] ?? 4;
  const secondsRemaining = usePhaseCountdown(revealEndsAt, stepSecondsFallback);

  const [stepTotalSeconds, setStepTotalSeconds] = useState(stepSecondsFallback);
  useEffect(() => {
    if (typeof revealEndsAt !== "number") {
      setStepTotalSeconds(stepSecondsFallback);
      return;
    }
    const total = Math.max(1, Math.ceil((revealEndsAt - Date.now()) / 1000));
    setStepTotalSeconds(total);
  }, [step, subStep, lieIndex, revealEndsAt, stepSecondsFallback]);

  const answersInRevealOrder = useMemo(() => game?.answers ?? [], [game?.answers]);

  const liesInRevealOrder = useMemo(
    () => answersInRevealOrder.filter((a) => !a.isTruth),
    [answersInRevealOrder],
  );

  const truthAnswer = useMemo(
    () => answersInRevealOrder.find((a) => a.isTruth) ?? null,
    [answersInRevealOrder],
  );

  const votesSummaryAnswers = useMemo(
    () => [...answersInRevealOrder].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)),
    [answersInRevealOrder],
  );

  const currentLie = liesInRevealOrder[lieIndex] ?? null;
  const pastLies = useMemo(
    () => (step === "per_lie" ? liesInRevealOrder.slice(0, lieIndex) : []),
    [step, liesInRevealOrder, lieIndex],
  );

  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);

  const cardProps = {
    step,
    subStep,
    lieIndex,
    liesInRevealOrder,
    players,
    roundScores,
    reduce,
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <motion.div className="text-center" {...headerMotion}>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${step}-${subStep ?? ""}`}
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

      {step === "votes_summary" ? (
        <div className="grid gap-3">
          {votesSummaryAnswers.map((answer) => (
            <RevealAnswerCard key={answer.answerId} answer={answer} {...cardProps} />
          ))}
        </div>
      ) : null}

      {step === "per_lie" && currentLie ? (
        <div className="flex flex-col gap-4">
          {pastLies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pastLies.map((answer) => (
                <RevealAnswerCard
                  key={answer.answerId}
                  answer={answer}
                  {...cardProps}
                  variant="chip"
                />
              ))}
            </div>
          ) : null}

          <RevealAnswerCard key={currentLie.answerId} answer={currentLie} {...cardProps} />

          <p className="text-center fibbage-micro">
            Lie {lieIndex + 1} of {liesInRevealOrder.length}
          </p>
        </div>
      ) : null}

      {(step === "truth" || step === "complete") && truthAnswer ? (
        <div className="grid gap-3">
          {step === "complete"
            ? liesInRevealOrder.map((answer) => (
                <RevealAnswerCard key={answer.answerId} answer={answer} {...cardProps} variant="chip" />
              ))
            : null}
          <RevealAnswerCard key={truthAnswer.answerId} answer={truthAnswer} {...cardProps} />
        </div>
      ) : null}

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

      <FibbageTimerBar
        secondsRemaining={secondsRemaining}
        totalSeconds={stepTotalSeconds}
        className="mx-auto"
      />
    </div>
  );
}
