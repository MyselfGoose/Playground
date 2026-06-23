"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import {
  revealBeat,
  revealCard,
  scoreBurst,
  scorePop,
  sectionEnter,
  truthReveal,
  voterStagger,
} from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const STEP_HEADINGS = {
  votes_summary: "The tally",
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
 *   answers: Array<{ answerId: string, text: string, voteCount?: number }>,
 *   maxVotes: number,
 *   reduce: boolean,
 * }} props
 */
function VoteSummaryBars({ answers, maxVotes, reduce }) {
  const sorted = [...answers].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));

  return (
    <div className="fibbage-vote-bar-row" aria-label="Vote tally">
      {sorted.map((answer, index) => {
        const votes = answer.voteCount ?? 0;
        const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
        return (
          <motion.div
            key={answer.answerId}
            className="fibbage-vote-bar"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
          >
            <span className="w-6 shrink-0 text-right text-xs font-bold text-[var(--fibbage-gold)]">
              {votes}
            </span>
            <div className="fibbage-vote-bar__track">
              <div
                className="fibbage-vote-bar__fill"
                style={{ width: `${pct}%`, animationDelay: `${index * 0.1}s` }}
              />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fibbage-text)]">
              {answer.text}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
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
 *   localUserId: string | null,
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
  localUserId,
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
  const isFuture = step === "per_answer" && answerIndex > currentAnswerIndex;
  const spotlight = step === "votes_summary" || isCurrent;

  const effectiveSubStep = reduce && isCurrent ? "points" : subStep;

  const lieFoolPoints =
    author && voters.length > 0 ? getLieFoolPoints(author.userId, voters, roundScores) : 0;

  const showAuthor =
    Boolean(author) &&
    !isTruth &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "author")));

  const showVoters =
    voters.length > 0 &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showNoFooled =
    !isTruth &&
    showAuthor &&
    voterCount === 0 &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showNoTruthFinders =
    isTruth &&
    (isFullyRevealed || isCurrent) &&
    voterCount === 0 &&
    (isFullyRevealed || subStepAtLeast(effectiveSubStep, "voters"));

  const showLiePoints =
    lieFoolPoints > 0 &&
    showAuthor &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const showTruthPoints =
    isTruth &&
    voters.some((v) => (roundScores[v.userId]?.truthPick?.points ?? 0) > 0) &&
    (isFullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const isViewerAuthor = localUserId && author?.userId === localUserId;
  const fooledViewer = localUserId && voters.some((v) => v.userId === localUserId) && !isTruth;
  const foundTruth = localUserId && isTruth && voters.some((v) => v.userId === localUserId);

  if (step === "per_answer" && isFuture && !reduce) {
    return null;
  }

  const cardClasses = [
    "fibbage-card fibbage-reveal-card overflow-hidden",
    isTruth && (spotlight || isFullyRevealed) ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
    isFuture ? "fibbage-card--dimmed" : "",
    isCurrent && !reduce ? "relative z-20" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardMotion =
    isTruth && (spotlight || isFullyRevealed) ? truthReveal(reduce) : revealCard(reduce, spotlight);
  const beatMotion = revealBeat(reduce);
  const pointsMotion = scoreBurst(reduce);
  const showVoteCount = typeof answer.voteCount === "number" && step !== "votes_summary";

  return (
    <motion.div layout={!reduce} className={cardClasses} {...cardMotion}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="fibbage-prompt-hero flex-1 text-base font-semibold">{answer.text}</p>
        {showVoteCount ? (
          <span className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]">
            {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isTruth && (spotlight || isFullyRevealed) ? (
        <div className="mt-2">
          <span className="fibbage-truth-stamp">The truth</span>
        </div>
      ) : null}

      {showAuthor ? (
        <motion.div key={`author-${answer.answerId}`} className="mt-4 flex items-center gap-2" {...beatMotion}>
          <Avatar
            username={author.username}
            avatarUrl={author.avatarUrl}
            avatarEmoji={author.avatarEmoji}
            size="sm"
          />
          <span className="text-sm font-bold text-[var(--fibbage-accent-glow)]">
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
            {voters.map((voter, vi) => (
              <motion.div
                key={voter.userId}
                className={`fibbage-voter-badge ${
                  isTruth ? "fibbage-voter-badge--sharp" : "fibbage-voter-badge--fooled"
                }`}
                {...voterStagger(vi, reduce)}
              >
                <Avatar
                  username={voter.username}
                  avatarUrl={voter.avatarUrl}
                  avatarEmoji={voter.avatarEmoji}
                  size="sm"
                />
                <span>{voter.username}</span>
                {!isTruth ? (
                  <span className="text-[10px] font-bold uppercase text-[var(--fibbage-lie)]">Fooled</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase text-[var(--fibbage-truth)]">Sharp!</span>
                )}
              </motion.div>
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
          className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-4 py-3"
          {...pointsMotion}
        >
          <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Points earned</span>
          <span className="fibbage-score-pop fibbage-score-pop--big">+{lieFoolPoints}</span>
        </motion.div>
      ) : null}

      {showTruthPoints ? (
        <motion.div
          key={`truth-points-${answer.answerId}`}
          className="mt-4 flex flex-col gap-2"
          {...pointsMotion}
        >
          {voters.map((voter) => {
            const pts = roundScores[voter.userId]?.truthPick?.points ?? 0;
            if (pts <= 0) return null;
            return (
              <div
                key={voter.userId}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-4 py-3"
              >
                <span className="text-xs font-semibold">{voter.username}</span>
                <span className="fibbage-score-pop">+{pts}</span>
              </div>
            );
          })}
        </motion.div>
      ) : null}

      {isCurrent && isViewerAuthor && lieFoolPoints > 0 && subStepAtLeast(effectiveSubStep, "points") ? (
        <motion.p
          className="mt-3 text-center text-sm font-bold text-[var(--fibbage-cta)]"
          {...beatMotion}
        >
          You fooled {voters.length} player{voters.length === 1 ? "" : "s"}!
        </motion.p>
      ) : null}

      {isCurrent && fooledViewer && subStepAtLeast(effectiveSubStep, "voters") ? (
        <motion.p
          className="mt-3 text-center text-sm font-bold text-[var(--fibbage-lie)]"
          {...beatMotion}
        >
          You were fooled!
        </motion.p>
      ) : null}

      {isCurrent && foundTruth && subStepAtLeast(effectiveSubStep, "voters") ? (
        <motion.p
          className="mt-3 text-center text-sm font-bold text-[var(--fibbage-truth)]"
          {...beatMotion}
        >
          You found the truth!
        </motion.p>
      ) : null}
    </motion.div>
  );
}

export function FibbageRevealStage() {
  const reduce = useReducedMotion();
  const { room, localUserId } = useFibbage();
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

  const maxVotes = useMemo(
    () => Math.max(1, ...answersInRevealOrder.map((a) => a.voteCount ?? 0)),
    [answersInRevealOrder],
  );

  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);
  const showVignette = step === "per_answer" && !reduce;

  return (
    <div className="fibbage-reveal-focus-stage mx-auto flex max-w-3xl flex-col gap-6">
      {showVignette ? (
        <div className="fibbage-reveal-vignette fibbage-reveal-vignette--active" aria-hidden />
      ) : null}

      <motion.div className="relative z-20 text-center" {...headerMotion}>
        <motion.p
          key={step}
          className="fibbage-eyebrow"
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {heading}
        </motion.p>
        <h2 className="mt-2 fibbage-display">{game?.prompt?.text}</h2>
      </motion.div>

      {step === "votes_summary" ? (
        <motion.div
          className="fibbage-card relative z-20"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <VoteSummaryBars answers={displayAnswers} maxVotes={maxVotes} reduce={reduce} />
        </motion.div>
      ) : (
        <div className="relative z-20 grid gap-4">
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
                localUserId={localUserId}
                reduce={reduce}
              />
            );
          })}
        </div>
      )}

      {step === "votes_summary" ? (
        <motion.p
          className="relative z-20 text-center fibbage-body"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.24 }}
        >
          Authors and voters will be revealed next…
        </motion.p>
      ) : null}

      {step === "per_answer" && answersInRevealOrder.length > 0 ? (
        <p className="relative z-20 text-center fibbage-micro">
          Answer {currentAnswerIndex + 1} of {answersInRevealOrder.length}
        </p>
      ) : null}
    </div>
  );
}
