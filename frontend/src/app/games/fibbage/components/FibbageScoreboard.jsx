"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { cardStagger, scorePop, sectionEnter } from "../../../../lib/fibbage/motion.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";
import { FibbageRoundRecap } from "./FibbageRoundRecap.jsx";

const SCORING_SECONDS = 6;
const BETWEEN_ROUNDS_SECONDS = 3;
const RECAP_MS = 2500;
const SHELL_MS = 300;

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

    const duration = 500;
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

export function FibbageScoreboard() {
  const reduce = useReducedMotion();
  const { room } = useFibbage();
  const game = room?.game;
  const roundScores = game?.roundScores ?? {};
  const highlights = game?.roundHighlights ?? [];
  const isBetweenRounds = game?.status === "between_rounds";
  const isScoring = game?.status === "scoring";
  const timerSeconds = isBetweenRounds ? BETWEEN_ROUNDS_SECONDS : SCORING_SECONDS;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, timerSeconds);
  const waitingForNextPrompt = isBetweenRounds && secondsRemaining === 0;
  const headerMotion = sectionEnter(reduce);
  const roundKey = `${game?.round ?? 0}-${game?.gameSessionId ?? ""}`;

  const [showRecap, setShowRecap] = useState(false);
  const [showRows, setShowRows] = useState(false);

  useEffect(() => {
    setShowRecap(false);
    setShowRows(false);
    if (!isScoring) {
      if (isBetweenRounds) {
        setShowRows(true);
      }
      return undefined;
    }
    if (highlights.length === 0) {
      const shellTimer = window.setTimeout(() => setShowRows(true), SHELL_MS);
      return () => window.clearTimeout(shellTimer);
    }
    const shellTimer = window.setTimeout(() => setShowRecap(true), SHELL_MS);
    const rowsTimer = window.setTimeout(() => setShowRows(true), SHELL_MS + RECAP_MS);
    return () => {
      window.clearTimeout(shellTimer);
      window.clearTimeout(rowsTimer);
    };
  }, [roundKey, isScoring, isBetweenRounds, highlights.length]);

  const handleRecapComplete = useCallback(() => {
    setShowRows(true);
  }, []);

  const sortedPlayers = useMemo(
    () => [...(room?.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [room?.players],
  );

  const topHighlight = highlights[0];
  const showRoundWinner =
    isBetweenRounds && topHighlight?.id === "biggest_swing" && topHighlight.body;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <motion.div className="text-center" {...headerMotion}>
        <p className="fibbage-eyebrow text-[var(--fibbage-gold)]">
          {isBetweenRounds ? "Next round" : "Round results"}
        </p>
        <h2 className="mt-2 text-2xl font-black text-[var(--fibbage-text)]">
          {waitingForNextPrompt
            ? "Loading next prompt…"
            : isBetweenRounds
              ? `Round ${(game?.round ?? 1) + 1} coming up`
              : `Round ${game?.round ?? 1} results`}
        </h2>
        {showRoundWinner ? (
          <p className="mt-2 text-sm text-[var(--fibbage-text-muted)]">{topHighlight.body}</p>
        ) : null}
      </motion.div>

      {waitingForNextPrompt ? (
        <motion.div
          className="flex flex-col gap-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-busy="true"
          aria-label="Loading next prompt"
        >
          <div className="fibbage-skeleton h-24 w-full rounded-2xl" />
          <div className="fibbage-skeleton h-4 w-48 mx-auto rounded-lg" />
          <div className="fibbage-skeleton h-2 w-full max-w-xs mx-auto rounded-full" />
        </motion.div>
      ) : (
        <>
          {isScoring && showRecap && highlights.length > 0 ? (
            <FibbageRoundRecap
              highlights={highlights}
              players={room?.players ?? []}
              onComplete={handleRecapComplete}
            />
          ) : null}

          {showRows ? (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {sortedPlayers.map((player, index) => {
                  const roundScore = roundScores[player.userId]?.totalRoundPoints ?? 0;
                  const isLeader = index === 0 && (player.score ?? 0) > 0;
                  const stagger = cardStagger(index, reduce);

                  return (
                    <motion.div
                      key={player.userId}
                      layout={!reduce}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                        isLeader
                          ? "border border-[var(--fibbage-gold)]/30 bg-[var(--fibbage-canvas-light)]"
                          : "bg-[var(--fibbage-canvas-light)]"
                      }`}
                      {...stagger}
                    >
                      <motion.span
                        className="w-6 text-center text-sm font-bold text-[var(--fibbage-text-muted)]"
                        layout={!reduce ? "position" : undefined}
                      >
                        {index + 1}
                      </motion.span>
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
              </AnimatePresence>
            </div>
          ) : null}
        </>
      )}

      {!waitingForNextPrompt ? (
        <FibbageTimerBar
          secondsRemaining={secondsRemaining}
          totalSeconds={timerSeconds}
          className="mx-auto"
        />
      ) : null}

      {isBetweenRounds && !waitingForNextPrompt ? (
        <p className="text-center fibbage-body">Get ready for the next lie…</p>
      ) : null}
    </div>
  );
}
