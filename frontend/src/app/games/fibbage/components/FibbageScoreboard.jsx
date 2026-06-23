"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, podiumEnter, rankPop, scorePop, sectionEnter } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbageRoundRecap } from "./FibbageRoundRecap.jsx";

const BETWEEN_ROUNDS_SECONDS = 3;
const SCORING_SECONDS_FALLBACK = 6;
const SCORING_SECONDS_MIN = 3;

const PODIUM_HEIGHTS = ["h-24", "h-16", "h-12"];
const PODIUM_ORDER = [1, 0, 2];

/**
 * @param {{ value: number, reduce: boolean, className?: string }} props
 */
function AnimatedScore({ value, reduce, className = "" }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (reduce || prevRef.current === value) {
      const frame = requestAnimationFrame(() => {
        setDisplay(value);
        prevRef.current = value;
      });
      return () => cancelAnimationFrame(frame);
    }

    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return undefined;

    const duration = 600;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  );
}

/**
 * @param {number | null | undefined} phaseEndsAt
 * @param {number} highlightCount
 */
function scoringTotalSeconds(phaseEndsAt, highlightCount) {
  if (typeof phaseEndsAt === "number") {
    const remaining = Math.ceil((phaseEndsAt - Date.now()) / 1000);
    if (remaining > 0) return remaining;
  }
  if (highlightCount === 0) return SCORING_SECONDS_MIN;
  if (highlightCount === 1) return 4;
  if (highlightCount === 2) return 5;
  return SCORING_SECONDS_FALLBACK;
}

/**
 * @param {{
 *   players: Array<{ userId: string, username: string, avatarUrl?: string | null, avatarEmoji?: string | null, score?: number }>,
 *   reduce: boolean,
 * }} props
 */
function ScoringPodiumPreview({ players, reduce }) {
  const top3 = players.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-3 py-4" aria-label="Top 3 players">
      {PODIUM_ORDER.map((podiumIdx) => {
        const player = top3[podiumIdx];
        if (!player) return <div key={`empty-${podiumIdx}`} className="w-20" />;
        return (
          <motion.div
            key={player.userId}
            className="flex w-20 flex-col items-center gap-2"
            {...podiumEnter(podiumIdx, reduce)}
          >
            <Avatar
              username={player.username}
              avatarUrl={player.avatarUrl}
              avatarEmoji={player.avatarEmoji}
              size={podiumIdx === 0 ? "md" : "sm"}
            />
            <span className="max-w-full truncate text-xs font-bold text-[var(--fibbage-text)]" title={player.username}>
              {player.username}
            </span>
            <div
              className={`fibbage-podium-pedestal w-full ${PODIUM_HEIGHTS[podiumIdx]} flex items-center justify-center`}
            >
              <span className="fibbage-score-pop text-sm">{player.score ?? 0}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function FibbageScoreboard() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const roundScores = game?.roundScores ?? {};
  const highlights = game?.roundHighlights ?? [];
  const isBetweenRounds = game?.status === "between_rounds";
  const isScoring = game?.status === "scoring";
  const timerSeconds = isBetweenRounds
    ? BETWEEN_ROUNDS_SECONDS
    : scoringTotalSeconds(game?.phaseEndsAt, highlights.length);
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, timerSeconds);
  const waitingForNextPrompt = isBetweenRounds && secondsRemaining === 0;
  const headerMotion = sectionEnter(reduce);
  const roundKey = `${game?.round ?? 0}-${game?.gameSessionId ?? ""}`;
  const [showRows, setShowRows] = useState(false);
  const [baselineRanks, setBaselineRanks] = useState(/** @type {Record<string, number>} */ ({}));

  useEffect(() => {
    if (game?.status === "revealing") {
      const ranks = {};
      [...(room?.players ?? [])]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .forEach((p, i) => {
          ranks[p.userId] = i + 1;
        });
      setBaselineRanks(ranks);
    }
  }, [game?.status, game?.round, room?.players]);

  useEffect(() => {
    if (isScoring || isBetweenRounds) {
      setShowRows(true);
    } else {
      setShowRows(false);
    }
  }, [roundKey, isScoring, isBetweenRounds]);

  const handleRecapComplete = useCallback(() => {}, []);

  const sortedPlayers = useMemo(
    () => [...(room?.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [room?.players],
  );

  const rankChanges = useMemo(() => {
    const changes = {};
    sortedPlayers.forEach((p, i) => {
      const prev = baselineRanks[p.userId];
      if (prev !== undefined && prev !== i + 1) {
        changes[p.userId] = prev - (i + 1);
      }
    });
    return changes;
  }, [sortedPlayers, baselineRanks]);

  const topHighlight = highlights[0];
  const showRoundWinner =
    isBetweenRounds && topHighlight?.id === "biggest_swing" && topHighlight.body;

  const showInlineRecap = isScoring && highlights.length > 0;
  const nextRound = (game?.round ?? 1) + 1;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <motion.div className="text-center" {...headerMotion}>
        <p className="fibbage-eyebrow text-[var(--fibbage-gold)]">
          {isBetweenRounds ? "Next round" : "Round results"}
        </p>
        <h2 className="mt-2 fibbage-display">
          {waitingForNextPrompt
            ? `Round ${nextRound}`
            : isBetweenRounds
              ? `Round ${nextRound} coming up`
              : `Round ${game?.round ?? 1} results`}
        </h2>
        {showRoundWinner ? (
          <p className="mt-2 text-sm text-[var(--fibbage-text-muted)]">{topHighlight.body}</p>
        ) : null}
      </motion.div>

      {waitingForNextPrompt ? (
        <motion.div
          className="fibbage-round-wipe"
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          aria-busy="true"
          aria-label="Loading next prompt"
        >
          <p className="fibbage-round-wipe__title">Round {nextRound}</p>
          <p className="mt-2 fibbage-body">Get ready for the next lie…</p>
          <div className="mx-auto mt-6 h-1 w-32 overflow-hidden rounded-full bg-[var(--fibbage-canvas-elevated)]">
            <motion.div
              className="fibbage-timer-bar h-full w-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
            />
          </div>
        </motion.div>
      ) : (
        <>
          {showInlineRecap ? (
            <FibbageRoundRecap
              highlights={highlights}
              players={room?.players ?? []}
              onComplete={handleRecapComplete}
            />
          ) : null}

          {isScoring && sortedPlayers.length >= 2 ? (
            <ScoringPodiumPreview players={sortedPlayers} reduce={reduce} />
          ) : null}

          {showRows ? (
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const roundScore = roundScores[player.userId]?.totalRoundPoints ?? 0;
                const isLeader = index === 0 && (player.score ?? 0) > 0;
                const rankChange = rankChanges[player.userId];
                const stagger = cardStagger(index, reduce);

                return (
                  <motion.div
                    key={player.userId}
                    layout={!reduce}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                      isLeader
                        ? "border border-[var(--fibbage-gold)]/30 bg-[var(--fibbage-canvas-light)] fibbage-winner-glow"
                        : "bg-[var(--fibbage-canvas-light)]"
                    }`}
                    {...stagger}
                  >
                    <span className="w-6 text-center text-sm font-bold text-[var(--fibbage-text-muted)]">
                      {index + 1}
                    </span>
                    <Avatar
                      username={player.username}
                      avatarUrl={player.avatarUrl}
                      avatarEmoji={player.avatarEmoji}
                      size="sm"
                    />
                    <span className="flex-1 text-sm font-semibold text-[var(--fibbage-text)]">
                      {player.username}
                    </span>
                    <AnimatePresence>
                      {rankChange !== undefined && rankChange !== 0 && isScoring ? (
                        <motion.span
                          key={`rank-${rankChange}`}
                          className={`fibbage-rank-arrow ${
                            rankChange > 0 ? "fibbage-rank-arrow--up" : "fibbage-rank-arrow--down"
                          }`}
                          {...rankPop(reduce)}
                        >
                          {rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    <AnimatePresence>
                      {!isBetweenRounds && roundScore > 0 ? (
                        <motion.span
                          key={`delta-${roundScore}`}
                          className="text-sm font-bold text-[var(--fibbage-gold)]"
                          {...scorePop(reduce)}
                        >
                          +{roundScore}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    <AnimatedScore
                      value={player.score ?? 0}
                      reduce={reduce}
                      className={`text-sm font-bold ${
                        isLeader ? "fibbage-score-pop text-base" : "text-[var(--fibbage-text-muted)]"
                      }`}
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      {!waitingForNextPrompt ? (
        <FibbageTimerBar
          secondsRemaining={secondsRemaining}
          totalSeconds={timerSeconds}
          className="mx-auto w-full max-w-md"
        />
      ) : null}

      {isBetweenRounds && !waitingForNextPrompt ? (
        <p className="text-center fibbage-body">Get ready for the next lie…</p>
      ) : null}
    </div>
  );
}
