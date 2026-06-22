"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import {
  contentExpand,
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

/** Backend phase durations in seconds — keep in sync with constants.js */
const REVEAL_STEP_SECONDS = {
  votes_summary: 4,
  per_lie: 8,
  truth: 5,
  complete: 2,
};

/** Client-side beats within each per-lie step (ms from lie step start) */
const LIE_REVEAL_BEATS_MS = {
  author: 600,
  voters: 2200,
  points: 4000,
};

/** Client-side beats within the truth step */
const TRUTH_REVEAL_BEATS_MS = {
  voters: 600,
  points: 2200,
};

/**
 * Lie index matches backend: order of non-truth answers in game.answers (not vote-sorted).
 * @param {string} answerId
 * @param {Array<{ answerId: string }>} liesInRevealOrder
 */
function getLieIndex(answerId, liesInRevealOrder) {
  return liesInRevealOrder.findIndex((a) => a.answerId === answerId);
}

/**
 * @param {string} step
 * @param {number} lieIndex
 * @param {Array<{ answerId: string, isTruth?: boolean }>} liesInRevealOrder
 * @param {string} answerId
 * @param {boolean} isTruth
 */
function isAnswerSpotlighted(step, lieIndex, liesInRevealOrder, answerId, isTruth) {
  if (isTruth) {
    return step === "truth" || step === "complete";
  }
  if (step === "votes_summary") return true;
  if (step === "per_lie") {
    return getLieIndex(answerId, liesInRevealOrder) === lieIndex;
  }
  return false;
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
 *   lieIndex: number,
 *   liesInRevealOrder: Array<{ answerId: string, isTruth?: boolean }>,
 *   lieRevealStage: 'highlight' | 'author' | 'voters' | 'points',
 *   truthRevealStage: 'highlight' | 'voters' | 'points',
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   roundScores: Record<string, { totalRoundPoints?: number, fooled?: Array<{ voterUserId: string, points: number }>, truthPick?: { points: number } }>,
 *   reduce: boolean,
 * }} props
 */
function RevealAnswerCard({
  answer,
  step,
  lieIndex,
  liesInRevealOrder,
  lieRevealStage,
  truthRevealStage,
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
  const lieIdx = isTruth ? -1 : getLieIndex(answer.answerId, liesInRevealOrder);
  const isCurrentLie = step === "per_lie" && lieIdx === lieIndex;
  const lieFullyRevealed =
    !isTruth &&
    lieIdx >= 0 &&
    ((step === "per_lie" && lieIdx < lieIndex) || step === "truth" || step === "complete");
  const isTruthStep = isTruth && (step === "truth" || step === "complete");
  const isCurrentTruth = step === "truth" && isTruth;

  const spotlight = isAnswerSpotlighted(
    step,
    lieIndex,
    liesInRevealOrder,
    answer.answerId,
    isTruth,
  );
  const dimmed =
    (step === "per_lie" && !spotlight && !isTruth && !lieFullyRevealed) ||
    (step === "truth" && !isTruth);

  const lieFoolPoints =
    author && voters.length > 0
      ? getLieFoolPoints(author.userId, voters, roundScores)
      : 0;

  const showAuthor =
    Boolean(author) &&
    (lieFullyRevealed ||
      (isCurrentLie &&
        (lieRevealStage === "author" ||
          lieRevealStage === "voters" ||
          lieRevealStage === "points")));

  const showVoters =
    voters.length > 0 &&
    (lieFullyRevealed ||
      isTruthStep ||
      (isCurrentLie &&
        (lieRevealStage === "voters" || lieRevealStage === "points")) ||
      (isCurrentTruth &&
        (truthRevealStage === "voters" || truthRevealStage === "points")));

  const showLiePoints =
    isCurrentLie &&
    lieRevealStage === "points" &&
    lieFoolPoints > 0 &&
    showAuthor;

  const showPastLiePoints = lieFullyRevealed && lieFoolPoints > 0 && showAuthor;

  const showTruthPoints =
    isTruth &&
    (step === "complete" || (isCurrentTruth && truthRevealStage === "points")) &&
    voters.some((v) => (roundScores[v.userId]?.truthPick?.points ?? 0) > 0);

  const cardClasses = [
    "fibbage-card overflow-hidden",
    isTruthStep ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
    dimmed ? "fibbage-card--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardMotion = isTruthStep ? truthReveal(reduce) : revealCard(reduce, spotlight);
  const beatMotion = revealBeat(reduce);
  const expandMotion = contentExpand(reduce);
  const pointsMotion = scorePop(reduce);
  const showVoteCount = typeof answer.voteCount === "number";

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
        {showAuthor ? (
          <motion.div
            key="author"
            className="mt-3 flex items-center gap-2"
            {...beatMotion}
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
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showVoters ? (
          <motion.div key="voters" className="mt-3" {...beatMotion}>
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
        ) : !author && !isTruth && lieFullyRevealed && voters.length === 0 ? (
          <motion.p key="no-votes" className="mt-2 text-xs text-[var(--fibbage-text-muted)]" {...expandMotion}>
            No votes
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showLiePoints || showPastLiePoints ? (
          <motion.div
            key="lie-points"
            className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-2"
            {...pointsMotion}
          >
            <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Points earned</span>
            <span className="text-lg font-black text-[var(--fibbage-gold)]">+{lieFoolPoints}</span>
          </motion.div>
        ) : null}

        {showTruthPoints ? (
          <motion.div key="truth-points" className="mt-3 flex flex-col gap-2" {...pointsMotion}>
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

/**
 * @param {boolean} reduce
 * @returns {'highlight' | 'author' | 'voters' | 'points'}
 */
function finalLieStage(reduce) {
  return reduce ? "points" : "highlight";
}

/**
 * @param {boolean} reduce
 * @returns {'highlight' | 'voters' | 'points'}
 */
function finalTruthStage(reduce) {
  return reduce ? "points" : "highlight";
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

  const answersInRevealOrder = useMemo(() => game?.answers ?? [], [game?.answers]);

  const liesInRevealOrder = useMemo(
    () => answersInRevealOrder.filter((a) => !a.isTruth),
    [answersInRevealOrder],
  );

  const displayAnswers = useMemo(() => {
    if (step === "votes_summary") {
      return [...answersInRevealOrder].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
    }
    return answersInRevealOrder;
  }, [answersInRevealOrder, step]);

  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);

  const [lieRevealStage, setLieRevealStage] = useState(() => finalLieStage(reduce));
  const [truthRevealStage, setTruthRevealStage] = useState(() => finalTruthStage(reduce));

  useEffect(() => {
    if (step !== "per_lie") return;

    if (reduce) {
      setLieRevealStage("points");
      return;
    }

    setLieRevealStage("highlight");
    const authorTimer = setTimeout(() => setLieRevealStage("author"), LIE_REVEAL_BEATS_MS.author);
    const votersTimer = setTimeout(() => setLieRevealStage("voters"), LIE_REVEAL_BEATS_MS.voters);
    const pointsTimer = setTimeout(() => setLieRevealStage("points"), LIE_REVEAL_BEATS_MS.points);

    return () => {
      clearTimeout(authorTimer);
      clearTimeout(votersTimer);
      clearTimeout(pointsTimer);
    };
  }, [step, lieIndex, reduce]);

  useEffect(() => {
    if (step !== "truth") return;

    if (reduce) {
      setTruthRevealStage("points");
      return;
    }

    setTruthRevealStage("highlight");
    const votersTimer = setTimeout(() => setTruthRevealStage("voters"), TRUTH_REVEAL_BEATS_MS.voters);
    const pointsTimer = setTimeout(() => setTruthRevealStage("points"), TRUTH_REVEAL_BEATS_MS.points);

    return () => {
      clearTimeout(votersTimer);
      clearTimeout(pointsTimer);
    };
  }, [step, reduce]);

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
        {displayAnswers.map((answer) => (
          <RevealAnswerCard
            key={answer.answerId}
            answer={answer}
            step={step}
            lieIndex={lieIndex}
            liesInRevealOrder={liesInRevealOrder}
            lieRevealStage={lieRevealStage}
            truthRevealStage={truthRevealStage}
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

      {step === "per_lie" && liesInRevealOrder.length > 0 ? (
        <p className="text-center fibbage-micro">
          Lie {lieIndex + 1} of {liesInRevealOrder.length}
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
