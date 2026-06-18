"use client";
/* eslint-disable react-hooks/set-state-in-effect -- review prompt UI syncs with realtime snapshots */

import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TabooFeedbackOverlay } from "./components/TabooFeedbackOverlay.jsx";
import { useGameFeedback } from "../../../lib/feedback/useGameFeedback.js";
import { useVisualViewportKeyboard } from "../../../lib/hooks/useVisualViewportKeyboard.js";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { useTabooCountdown } from "../../../lib/taboo/useTabooCountdown.js";
import { useFocusTrap } from "../../../lib/a11y/useFocusTrap.js";
import { TabooPhaseAnnouncer } from "./TabooPhaseAnnouncer.jsx";
import { TabooActivityFeed } from "./components/TabooActivityFeed.jsx";
import { TabooCardPanel } from "./components/TabooCardPanel.jsx";
import { TabooConfirmDialog } from "./components/TabooConfirmDialog.jsx";
import { TabooErrorBanner } from "./components/TabooErrorBanner.jsx";
import { TabooGameActions } from "./components/TabooGameActions.jsx";
import { TabooPhasePanel } from "./components/TabooPhasePanel.jsx";
import { TabooPlayHeader } from "./components/TabooPlayHeader.jsx";
import { TabooPlayShell } from "./components/TabooPlayShell.jsx";
import { TabooReviewOverlay } from "./components/TabooReviewOverlay.jsx";
import { TabooRoleBadge } from "./components/TabooRoleBadge.jsx";
import { TabooScoreHeader } from "./components/TabooScoreHeader.jsx";
import { TabooTurnBadge } from "./components/TabooTurnBadge.jsx";

/**
 * @param {{ room: object }} props
 */
export function TabooPlay({ room }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    connectionState,
    serverNow,
    localUserId,
    startTurn,
    submitGuess,
    skipCard,
    tabooCalled,
    requestReview,
    dismissReview,
    reviewVote,
    leaveRoom,
  } = useTaboo();

  const [guess, setGuess] = useState("");
  const [error, setError] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const lastPromptedReviewIdRef = useRef(null);
  const guessRowRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const reviewPanelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const game = room?.game;
  const review = game?.review;
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
  const showReviewPanel = review?.status === "in_progress";
  const reviewPaused = review?.status === "in_progress";
  const hasVoted = Boolean(
    localUserId && Array.isArray(review?.votes) && review.votes.some((entry) => entry.playerId === localUserId && entry.vote),
  );

  useFocusTrap(Boolean(showReviewPanel), reviewPanelRef);

  const connectionBanner =
    connectionState === "reconnecting" || connectionState === "disconnected" ? (
      <p className="mb-3 rounded-xl border border-taboo-warning/30 bg-taboo-warning-soft px-3 py-2 text-sm font-semibold text-taboo-warning">
        Reconnecting… actions are temporarily disabled.
      </p>
    ) : null;

  return (
    <TabooPlayShell
      header={
        <TabooPlayHeader
          roundNumber={game?.roundNumber || 0}
          totalRounds={game?.totalRounds || 0}
          onLeave={() => setShowLeaveConfirm(true)}
        />
      }
      banner={
        <>
          <TabooPhaseAnnouncer game={game} />
          <TabooFeedbackOverlay variant={feedbackVariant} reduceMotion={reduceMotion} />
        </>
      }
    >
      <AnimatePresence>{connectionBanner}</AnimatePresence>
      <TabooErrorBanner message={error} className="mb-3" />

      <TabooScoreHeader
        game={game}
        room={room}
        localUserId={localUserId}
        secondsRemaining={secondsRemaining}
        normalizedStatus={normalizedStatus}
        reduceMotion={reduceMotion}
      />

      <div className="mb-3 flex flex-col items-center gap-2">
        <TabooTurnBadge activeTeam={game?.activeTeam} />
        <TabooRoleBadge viewerRole={role} />
      </div>

      {showReviewPanel ? (
        <TabooReviewOverlay
          review={review}
          canVoteReview={Boolean(game?.permissions?.canVoteReview)}
          hasVoted={hasVoted}
          secondsRemaining={secondsRemaining}
          isRealtimeConnected={isRealtimeConnected}
          onVote={(vote) => act(reviewVote, vote)}
          reduceMotion={reduceMotion}
          panelRef={reviewPanelRef}
        />
      ) : null}

      {normalizedStatus !== "turn_in_progress" ? (
        <div className="mb-4">
          <TabooPhasePanel
            game={{ ...game, status: normalizedStatus }}
            canStartTurn={Boolean(game?.permissions?.canStartTurn) && isRealtimeConnected}
            onStartTurn={() => act(startTurn)}
            countdown={secondsRemaining}
            startTurnDisabled={!isRealtimeConnected && Boolean(game?.permissions?.canStartTurn)}
          />
        </div>
      ) : null}

      {normalizedStatus === "turn_in_progress" && !reviewPaused ? (
        <>
          <TabooCardPanel game={game} reduceMotion={reduceMotion} />
          <TabooGameActions
            permissions={game?.permissions}
            guess={guess}
            onGuessChange={setGuess}
            onSubmitGuess={() => {
              act(submitGuess, guess);
              setGuess("");
            }}
            onSkipCard={() => act(skipCard)}
            onCallTaboo={() => act(tabooCalled)}
            isRealtimeConnected={isRealtimeConnected}
            guessRowRef={guessRowRef}
            onGuessFocus={() => refreshGuessKeyboard()}
          />
        </>
      ) : null}

      <TabooActivityFeed history={game?.history} reduceMotion={reduceMotion} />

      <TabooConfirmDialog
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

      <TabooConfirmDialog
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
    </TabooPlayShell>
  );
}
