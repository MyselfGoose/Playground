"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  MessageCircle,
  SkipForward,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerBar } from "../../../components/game-feel/TimerBar.jsx";
import { GameFeedbackOverlay } from "../../../components/feedback/GameFeedbackOverlay.jsx";
import { ConfirmDialog } from "../../../components/taboo/ConfirmDialog.jsx";
import { useGameFeedback } from "../../../lib/feedback/useGameFeedback.js";
import { useVisualViewportKeyboard } from "../../../lib/hooks/useVisualViewportKeyboard.js";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { motionPresets } from "../../../lib/taboo/motion.js";
import { useTabooCountdown } from "../../../lib/taboo/useTabooCountdown.js";
import { teamColors } from "../../../lib/taboo/variants.js";
import { PhasePanel, ROLE_BADGES, tabooPath } from "./taboo-shared.js";

/**
 * @param {{ room: object }} props
 */
export function TabooPlay({ room }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    connectionState,
    serverNow,
    serverOffsetMs,
    startTurn,
    holdTurnStart,
    submitGuess,
    skipCard,
    tabooCalled,
    requestReview,
    dismissReview,
    reviewVote,
    reviewContinue,
    leaveRoom,
  } = useTaboo();

  const [guess, setGuess] = useState("");
  const [error, setError] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const lastPromptedReviewIdRef = useRef(null);
  const guessRowRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const game = room?.game;
  const review = game?.review;
  const autoStartTurn = room?.settings?.autoStartTurn !== false;
  const teamA = teamColors("A");
  const teamB = teamColors("B");
  const role = game?.viewerRole || "spectator";
  const isRealtimeConnected = connectionState === "connected";
  const canSubmitGuess = Boolean(game?.permissions?.canSubmitGuess);

  const countdownEndsAt =
    review?.status === "in_progress"
      ? game?.phaseEndsAt
      : game?.turnEndsAt || game?.phaseEndsAt || game?.roundEndsAt;

  const secondsRemaining = useTabooCountdown(serverNow, countdownEndsAt, game?.secondsRemaining ?? 0);

  const { refresh: refreshGuessKeyboard } = useVisualViewportKeyboard(guessRowRef, {
    enabled: canSubmitGuess,
  });

  const feedbackVariant = useGameFeedback({
    history: game?.history,
    review: game?.review,
    gameStatus: game?.status,
    reduceMotion,
  });

  async function act(action, payload) {
    const result = await action(payload);
    if (!result.ok) setError(result.error.message);
    else setError("");
  }

  useEffect(() => {
    if (review?.status !== "available" || !game?.permissions?.canRequestReview || !review?.id) {
      setShowReviewPrompt(false);
      return;
    }
    if (lastPromptedReviewIdRef.current === review.id) return;
    lastPromptedReviewIdRef.current = review.id;
    setShowReviewPrompt(true);
  }, [review?.status, review?.id, game?.permissions?.canRequestReview]);

  const normalizedStatus = game?.status === "in_progress" ? "turn_in_progress" : game?.status;
  const roundDuration = room?.settings?.roundDurationSeconds ?? 60;
  const roleBadge = ROLE_BADGES[role] || ROLE_BADGES.spectator;
  const RoleIcon = roleBadge.icon;
  const showReviewPanel = review && (review.status === "in_progress" || review.status === "resolved");
  const reviewPaused = review?.status === "in_progress" || review?.status === "resolved";
  const activeTeamStyle = game?.activeTeam === "B" ? teamB : teamA;

  return (
    <motion.div className="min-h-dvh bg-background text-foreground">
      <GameFeedbackOverlay variant={feedbackVariant} reduceMotion={reduceMotion} />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col px-4 py-4 pb-[calc(var(--keyboard-offset,0px)+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 text-foreground/55 hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            Leave
          </button>
          <p className="text-sm font-semibold text-foreground/70">
            Round {game?.roundNumber || 0}/{game?.totalRounds || 0}
          </p>
        </div>

        <AnimatePresence>
          {connectionState === "reconnecting" || connectionState === "disconnected" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning"
            >
              Reconnecting… actions are temporarily disabled.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {error ? (
          <p className="mb-3 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div
            className={cn(
              "rounded-xl border p-3",
              game.activeTeam === "A" ? teamA.activeScoreBg : teamA.inactiveScoreBg,
            )}
          >
            <p className="text-xs font-semibold text-foreground/55">Alpha</p>
            <p className="text-2xl font-black">{game.scores?.A ?? 0}</p>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-foreground/10 bg-background/90 p-3 text-center shadow-sm">
            <Clock className="mx-auto mb-1 h-4 w-4 text-foreground/45" />
            {normalizedStatus === "turn_in_progress" && typeof countdownEndsAt === "number" ? (
              <TimerBar
                endsAt={countdownEndsAt}
                serverOffsetMs={serverOffsetMs}
                totalSeconds={roundDuration}
                warnAtSeconds={10}
                className="relative"
              />
            ) : (
              <p className="font-mono text-2xl font-black tabular-nums text-foreground">{secondsRemaining}</p>
            )}
          </div>
          <motion.div
            className={cn(
              "rounded-xl border p-3",
              game.activeTeam === "B" ? teamB.activeScoreBg : teamB.inactiveScoreBg,
            )}
          >
            <p className="text-right text-xs font-semibold text-foreground/55">Beta</p>
            <p className="text-right text-2xl font-black">{game.scores?.B ?? 0}</p>
          </motion.div>
        </div>

        <div className="mb-3 flex justify-center">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
              roleBadge.className,
            )}
          >
            <RoleIcon className="h-3.5 w-3.5" />
            {roleBadge.label}
          </div>
        </div>

        {showReviewPanel ? (
          <div className="mb-4 rounded-2xl border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">Taboo review</p>
                <p className="text-sm font-bold text-foreground">
                  {review.status === "in_progress" ? "Review in progress" : "Review resolved"}
                </p>
                {review.status === "in_progress" && secondsRemaining > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-primary">Voting ends in {secondsRemaining}s</p>
                ) : null}
                <p className="text-xs text-foreground/55">
                  Called by {review?.tabooCalledBy?.playerName || "Opponent"} · Team{" "}
                  {review?.penalizedTeam === "B" ? "Beta" : "Alpha"} penalized
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-foreground/10 bg-muted-bright/30 px-3 py-1 text-xs font-semibold text-foreground/70">
                {review?.notFairCount ?? 0} not fair · {review?.fairCount ?? 0} fair
              </span>
            </div>
            {review.tabooCard ? (
              <div className="mb-3 rounded-xl border border-foreground/10 bg-muted-bright/20 p-4">
                <h3 className="text-center text-2xl font-black text-foreground">{review.tabooCard.question}</h3>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {(review.tabooCard.taboo || []).map((word) => (
                    <span
                      key={word}
                      className="rounded-lg border border-primary/30 bg-pastel-peach/80 px-2.5 py-1 text-xs font-bold text-primary dark:bg-primary/15"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {game?.permissions?.canVoteReview ? (
                <>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl border border-success/40 bg-pastel-mint/80 px-4 py-2 text-sm font-bold text-success dark:bg-success/15"
                    onClick={() => act(reviewVote, "fair")}
                    disabled={!isRealtimeConnected}
                  >
                    Vote fair
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-xl border border-primary/40 bg-pastel-peach/80 px-4 py-2 text-sm font-bold text-primary dark:bg-primary/15"
                    onClick={() => act(reviewVote, "not_fair")}
                    disabled={!isRealtimeConnected}
                  >
                    Vote not fair
                  </button>
                </>
              ) : null}
              {game?.permissions?.canContinueAfterReview ? (
                <button
                  type="button"
                  className="min-h-11 w-full rounded-xl border border-accent-sky/40 bg-pastel-sky/80 px-4 py-2 text-sm font-bold text-accent-sky dark:bg-accent-sky/15"
                  onClick={() => act(reviewContinue)}
                  disabled={!isRealtimeConnected}
                >
                  Continue turn
                </button>
              ) : null}
            </div>
            {review?.status === "resolved" ? (
              <p className="mt-3 text-xs text-foreground/55">
                {review?.fairCount ?? 0} fair · {review?.notFairCount ?? 0} not fair · {review?.eligibleCount ?? 0}{" "}
                total
              </p>
            ) : null}
            {Array.isArray(review?.votes) && review.votes.length > 0 ? (
              <div className="mt-3 rounded-xl border border-foreground/10 bg-muted-bright/20 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/50">Votes</p>
                <motion.div className="space-y-1 text-xs text-foreground/70">
                  {review.votes.map((voteEntry) => (
                    <div key={voteEntry.playerId} className="flex items-center justify-between">
                      <span>{voteEntry.playerName || "Player"}</span>
                      <span className="font-semibold capitalize text-foreground">
                        {voteEntry.vote ? voteEntry.vote.replace("_", " ") : "pending"}
                      </span>
                    </div>
                  ))}
                </motion.div>
              </div>
            ) : null}
          </div>
        ) : null}

        {normalizedStatus !== "turn_in_progress" ? (
          <div className="mb-4">
            <PhasePanel
              game={{ ...game, status: normalizedStatus }}
              autoStartTurn={autoStartTurn}
              turnStartHeld={Boolean(game?.turnStartHeld)}
              canStartTurn={Boolean(game?.permissions?.canStartTurn) && isRealtimeConnected}
              canHoldTurnStart={Boolean(game?.permissions?.canHoldTurnStart) && isRealtimeConnected}
              onStartTurn={() => act(startTurn)}
              onHoldTurnStart={() => act(holdTurnStart)}
              countdown={secondsRemaining}
              startTurnDisabled={!isRealtimeConnected && Boolean(game?.permissions?.canStartTurn)}
            />
          </div>
        ) : null}

        {normalizedStatus === "turn_in_progress" && !reviewPaused ? (
          <>
            <motion.div
              key={game?.currentCard?.id || "hidden"}
              {...(reduceMotion ? {} : motionPresets.cardSwap)}
              className="mb-4 flex min-h-[280px] flex-col rounded-2xl border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)]"
            >
              {game?.cardVisibleToViewer && game?.currentCard ? (
                <>
                  <div className="mb-4 flex justify-center">
                    <span className="rounded-full bg-muted-bright/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      {game.currentCard.category || "—"}
                    </span>
                  </div>
                  <div className="flex flex-1 items-center justify-center">
                    <h2 className="text-center text-3xl font-black leading-tight text-foreground">
                      {game.currentCard.question || "Waiting"}
                    </h2>
                  </div>
                  <div className="mt-4 border-t border-foreground/10 pt-4">
                    <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-primary">
                      Forbidden words
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {(game.currentCard.taboo || []).map((word, index) => (
                        <motion.span
                          key={word}
                          {...(reduceMotion ? {} : motionPresets.tabooWord(index))}
                          className="rounded-lg border border-primary/25 bg-pastel-peach/80 px-2.5 py-1 text-xs font-bold text-primary dark:bg-primary/15"
                        >
                          {word}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <p className="mb-2 text-lg font-black text-foreground">Hidden card</p>
                  <p className="text-sm text-foreground/55">Guess the word from your clue giver.</p>
                </div>
              )}
            </motion.div>
            <div className="mb-3 flex flex-wrap gap-2">
              {game?.permissions?.canSubmitGuess ? (
                <div ref={guessRowRef} className="flex w-full gap-2">
                  <input
                    className="h-11 flex-1 rounded-xl border border-foreground/15 bg-muted-bright/20 px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder={isRealtimeConnected ? "Type your guess…" : "Reconnecting…"}
                    onFocus={() => refreshGuessKeyboard()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        act(submitGuess, guess);
                        setGuess("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-success/40 bg-pastel-mint/80 px-4 text-sm font-bold text-success disabled:opacity-50 dark:bg-success/15"
                    disabled={!isRealtimeConnected}
                    onClick={() => {
                      act(submitGuess, guess);
                      setGuess("");
                    }}
                  >
                    Guess
                  </button>
                </div>
              ) : null}
              {game?.permissions?.canSkipCard ? (
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-warning/35 bg-warning/15 p-4 font-bold text-warning disabled:opacity-50"
                  disabled={!isRealtimeConnected}
                  onClick={() => act(skipCard)}
                >
                  <SkipForward className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Skip card</span>
                </button>
              ) : null}
              {game?.permissions?.canCallTaboo ? (
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-primary/35 bg-pastel-peach/80 p-4 font-bold text-primary disabled:opacity-50 dark:bg-primary/15"
                  disabled={!isRealtimeConnected}
                  onClick={() => act(tabooCalled)}
                >
                  <AlertTriangle className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Call taboo!</span>
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {review?.status === "available" && game?.permissions?.canRequestReview ? (
          <button
            type="button"
            className="mb-3 rounded-xl border border-accent-sky/40 bg-pastel-sky/80 px-4 py-2 text-sm font-bold text-accent-sky dark:bg-accent-sky/15"
            onClick={() => act(requestReview)}
            disabled={!isRealtimeConnected}
          >
            Request review
          </button>
        ) : null}

        {Array.isArray(game?.history) && game.history.length > 0 ? (
          <motion.div className="mt-3 max-h-[220px] overflow-y-auto rounded-xl border border-foreground/10 bg-muted-bright/20 px-3 py-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50">Game log</p>
            {game.history.map((entry, i) => {
              const key = `${entry.at}-${entry.action}-${i}`;
              if (entry.action === "submit_guess" && entry.matched) {
                return (
                  <motion.div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{entry.playerName} guessed correctly!</span>
                  </motion.div>
                );
              }
              if (entry.action === "submit_guess") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs text-foreground/55">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>
                      {entry.playerName}: &quot;{entry.guess}&quot;
                    </span>
                  </div>
                );
              }
              if (entry.action === "close_guess") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-warning">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>
                      {entry.playerName}: close guess &quot;{entry.guess}&quot;
                    </span>
                  </div>
                );
              }
              if (entry.action === "skip_card") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-warning">
                    <SkipForward className="h-3.5 w-3.5" />
                    <span>{entry.playerName} skipped the card</span>
                  </div>
                );
              }
              if (entry.action === "taboo_called") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-primary">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      Taboo! −1 for Team {entry.penalizedTeam === "B" ? "Beta" : "Alpha"}
                    </span>
                  </div>
                );
              }
              if (entry.action === "review_vote") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-accent-sky">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {entry.playerName} voted {entry.vote?.replace("_", " ")}
                    </span>
                  </div>
                );
              }
              if (entry.action === "review_resolved") {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs font-semibold text-accent-sky">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Review resolved: {entry.outcome}</span>
                  </div>
                );
              }
              if (
                entry.action === "turn_started" ||
                entry.action === "turn_ended" ||
                entry.action === "round_started" ||
                entry.action === "round_completed" ||
                entry.action === "game_finished"
              ) {
                return (
                  <div key={key} className="flex items-center gap-2 py-1 text-xs text-foreground/50">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{entry.action.replaceAll("_", " ")}</span>
                  </div>
                );
              }
              return null;
            })}
          </motion.div>
        ) : null}
      </div>

      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave game?"
        description="You'll be removed from the game in progress. This can't be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={async () => {
          await leaveRoom();
          router.push("/games/taboo");
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <ConfirmDialog
        open={showReviewPrompt}
        title="Taboo called"
        description="The opposing team called Taboo. Do you want to request a review, or ignore it and continue?"
        confirmLabel="Request review"
        cancelLabel="Ignore"
        variant="primary"
        onConfirm={() => {
          setShowReviewPrompt(false);
          act(requestReview);
        }}
        onCancel={() => {
          setShowReviewPrompt(false);
          act(dismissReview);
        }}
      />
    </motion.div>
  );
}
