"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import {
  FIBBAGE_EASE,
  revealCardSwap,
  revealSection,
  scoreBurst,
  sectionEnter,
  voteBarFill,
  voterStagger,
} from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";

const STEP_HEADINGS = {
  votes_summary: "The tally",
  per_answer: "Who wrote what?",
  complete: "Round complete",
};

const SUB_STEP_ORDER = { highlight: 0, author: 1, voters: 2, points: 3 };
const REVEAL_COMPLETE_SECONDS = 5;

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
 * @param {{ show: boolean, sectionKey: string, reduce: boolean, className?: string, children: import('react').ReactNode | (() => import('react').ReactNode) }} props
 */
function RevealSection({ show, sectionKey, reduce, className = "", children }) {
  const renderChildren = () => (typeof children === "function" ? children() : children);

  if (reduce) {
    return show ? <div className={className}>{renderChildren()}</div> : null;
  }

  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key={sectionKey}
          className={className}
          {...revealSection(reduce)}
        >
          {renderChildren()}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
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
            transition={{ delay: index * 0.08, duration: 0.35, ease: FIBBAGE_EASE }}
          >
            <span className="w-6 shrink-0 text-right text-xs font-bold text-[var(--fibbage-gold)]">
              {votes}
            </span>
            <div className="fibbage-vote-bar__track">
              <motion.div
                className="fibbage-vote-bar__fill"
                style={{ width: `${pct}%`, transformOrigin: "left" }}
                {...voteBarFill(index * 0.1, reduce)}
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
 *   step: string,
 *   subStep: string | null,
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null }>,
 *   roundScores: Record<string, { totalRoundPoints?: number, fooled?: Array<{ voterUserId: string, points: number }>, truthPick?: { points: number } }>,
 *   localUserId: string | null,
 *   reduce: boolean,
 *   fullyRevealed?: boolean,
 *   isCurrent?: boolean,
 * }} props
 */
function RevealAnswerCard({
  answer,
  step,
  subStep,
  players,
  roundScores,
  localUserId,
  reduce,
  fullyRevealed = false,
  isCurrent = false,
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

  const effectiveSubStep = reduce && isCurrent && !fullyRevealed ? "points" : subStep;

  const lieFoolPoints =
    author && voters.length > 0 ? getLieFoolPoints(author.userId, voters, roundScores) : 0;

  const showAuthor =
    !isTruth &&
    Boolean(answer.authorUserId) &&
    (fullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "author")));

  const showVoters =
    voters.length > 0 &&
    (fullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showNoFooled =
    !isTruth &&
    showAuthor &&
    voterCount === 0 &&
    (fullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "voters")));

  const showNoTruthFinders =
    isTruth &&
    (fullyRevealed || isCurrent) &&
    voterCount === 0 &&
    (fullyRevealed || subStepAtLeast(effectiveSubStep, "voters"));

  const showLiePoints =
    lieFoolPoints > 0 &&
    showAuthor &&
    (fullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const showTruthPoints =
    isTruth &&
    voters.some((v) => (roundScores[v.userId]?.truthPick?.points ?? 0) > 0) &&
    (fullyRevealed || (isCurrent && subStepAtLeast(effectiveSubStep, "points")));

  const isViewerAuthor = localUserId && author?.userId === localUserId;
  const fooledViewer = localUserId && voters.some((v) => v.userId === localUserId) && !isTruth;
  const foundTruth = localUserId && isTruth && voters.some((v) => v.userId === localUserId);

  const spotlight = fullyRevealed || isCurrent || step === "votes_summary";
  const pointsMotion = scoreBurst(reduce);
  const showVoteCount = typeof answer.voteCount === "number" && step !== "votes_summary";

  const cardClasses = [
    "fibbage-card fibbage-reveal-card overflow-hidden",
    isTruth && spotlight ? "fibbage-card--truth" : "",
    spotlight && !isTruth ? "fibbage-card--spotlight" : "",
    isCurrent && !reduce ? "relative z-20" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="fibbage-prompt-hero flex-1 text-base font-semibold">{answer.text}</p>
        {showVoteCount ? (
          <span className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]">
            {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <RevealSection show={isTruth && spotlight} sectionKey="truth-stamp" reduce={reduce} className="mt-2">
        <span className="fibbage-truth-stamp">The truth</span>
      </RevealSection>

      <RevealSection show={showAuthor} sectionKey="author" reduce={reduce} className="mt-4 flex items-center gap-2">
        {() =>
          author ? (
            <>
              <Avatar
                username={author.username}
                avatarUrl={author.avatarUrl}
                avatarEmoji={author.avatarEmoji}
                size="sm"
              />
              <span className="text-sm font-bold text-[var(--fibbage-accent-glow)]">
                {author.username} wrote this
              </span>
            </>
          ) : null
        }
      </RevealSection>

      <RevealSection show={showVoters} sectionKey="voters" reduce={reduce} className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">
            {isTruth ? "Found the truth:" : "Fooled:"}
          </span>
          <AnimatePresence mode="popLayout">
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
          </AnimatePresence>
        </div>
      </RevealSection>

      <RevealSection show={showNoFooled} sectionKey="no-fools" reduce={reduce} className="mt-3 text-sm text-[var(--fibbage-text-muted)]">
        Nobody was fooled
      </RevealSection>

      <RevealSection show={showNoTruthFinders} sectionKey="no-truth" reduce={reduce} className="mt-3 text-sm text-[var(--fibbage-text-muted)]">
        Nobody found the truth
      </RevealSection>

      <AnimatePresence mode="wait">
        {showLiePoints ? (
          <motion.div
            key="lie-points"
            className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-4 py-3"
            {...pointsMotion}
          >
            <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Points earned</span>
            <span className="fibbage-score-pop fibbage-score-pop--big">+{lieFoolPoints}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showTruthPoints ? (
          <motion.div key="truth-points" className="mt-4 flex flex-col gap-2" {...pointsMotion}>
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
      </AnimatePresence>

      <RevealSection
        show={Boolean(isCurrent && isViewerAuthor && lieFoolPoints > 0 && subStepAtLeast(effectiveSubStep, "points"))}
        sectionKey="viewer-fooled"
        reduce={reduce}
        className="mt-3 text-center text-sm font-bold text-[var(--fibbage-cta)]"
      >
        You fooled {voters.length} player{voters.length === 1 ? "" : "s"}!
      </RevealSection>

      <RevealSection
        show={Boolean(isCurrent && fooledViewer && subStepAtLeast(effectiveSubStep, "voters"))}
        sectionKey="viewer-was-fooled"
        reduce={reduce}
        className="mt-3 text-center text-sm font-bold text-[var(--fibbage-lie)]"
      >
        You were fooled!
      </RevealSection>

      <RevealSection
        show={Boolean(isCurrent && foundTruth && subStepAtLeast(effectiveSubStep, "voters"))}
        sectionKey="viewer-found-truth"
        reduce={reduce}
        className="mt-3 text-center text-sm font-bold text-[var(--fibbage-truth)]"
      >
        You found the truth!
      </RevealSection>
    </div>
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
  const completeSecondsRemaining = usePhaseCountdown(
    step === "complete" ? game?.reveal?.phaseEndsAt : null,
    REVEAL_COMPLETE_SECONDS,
  );

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

  const currentAnswer = answersInRevealOrder[currentAnswerIndex] ?? null;
  const roundScores = game?.roundScores ?? {};
  const heading = STEP_HEADINGS[step] ?? "Results";
  const headerMotion = sectionEnter(reduce);
  const showVignette = step === "per_answer" && !reduce;
  const cardSwapMotion = revealCardSwap(reduce);

  return (
    <div className="fibbage-reveal-focus-stage mx-auto flex max-w-3xl flex-col gap-6">
      {showVignette ? (
        <div className="fibbage-reveal-vignette fibbage-reveal-vignette--active" aria-hidden />
      ) : null}

      <motion.div className="relative z-20 text-center" {...headerMotion}>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="fibbage-eyebrow"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.32, ease: FIBBAGE_EASE }}
          >
            {heading}
          </motion.p>
        </AnimatePresence>
        <h2 className="mt-2 fibbage-display">{game?.prompt?.text}</h2>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "votes_summary" ? (
          <motion.div
            key="votes-summary"
            className="fibbage-card relative z-20"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.38, ease: FIBBAGE_EASE }}
          >
            <VoteSummaryBars answers={displayAnswers} maxVotes={maxVotes} reduce={reduce} />
          </motion.div>
        ) : null}

        {step === "per_answer" && currentAnswer ? (
          <motion.div
            key={`answer-${currentAnswerIndex}`}
            className="relative z-20"
            {...cardSwapMotion}
          >
            <RevealAnswerCard
              answer={currentAnswer}
              step={step}
              subStep={subStep}
              players={players}
              roundScores={roundScores}
              localUserId={localUserId}
              reduce={reduce}
              isCurrent
            />
          </motion.div>
        ) : null}

        {step === "complete" ? (
          <motion.div
            key="complete"
            className="relative z-20 space-y-4"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: FIBBAGE_EASE }}
          >
            <p className="text-center fibbage-body">
              All answers revealed — scores coming up in {completeSecondsRemaining}s…
            </p>
            <div className="grid gap-3">
              {answersInRevealOrder.map((answer) => (
                <RevealAnswerCard
                  key={answer.answerId}
                  answer={answer}
                  step={step}
                  subStep="points"
                  players={players}
                  roundScores={roundScores}
                  localUserId={localUserId}
                  reduce={reduce}
                  fullyRevealed
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {step === "votes_summary" ? (
        <motion.p
          className="relative z-20 text-center fibbage-body"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          Authors and voters will be revealed next…
        </motion.p>
      ) : null}

      {step === "per_answer" && answersInRevealOrder.length > 0 ? (
        <motion.p
          key={`progress-${currentAnswerIndex}`}
          className="relative z-20 text-center fibbage-micro"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          Answer {currentAnswerIndex + 1} of {answersInRevealOrder.length}
        </motion.p>
      ) : null}
    </div>
  );
}
