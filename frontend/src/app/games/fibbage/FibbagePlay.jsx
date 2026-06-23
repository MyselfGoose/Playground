"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { FibbageFeedbackProvider, useFibbageFeedback } from "../../../lib/fibbage/FibbageFeedbackContext.jsx";
import { phaseEnter } from "../../../lib/fibbage/motion.js";
import { useLeaveLobby } from "../../../lib/party/useLeaveLobby.js";
import { LeaveLobbyDialog } from "../../../components/party/LeaveLobbyDialog.jsx";
import { FibbageHost } from "./components/FibbageHost.jsx";
import { FibbageScoreRail } from "./components/FibbageScoreRail.jsx";
import { FibbagePromptReveal } from "./components/FibbagePromptCard.jsx";
import { FibbageWritingPanel } from "./components/FibbageWritingPanel.jsx";
import { FibbageVotingGrid } from "./components/FibbageVotingGrid.jsx";
import { FibbageRevealStage } from "./components/FibbageRevealStage.jsx";
import { FibbageScoreboard } from "./components/FibbageScoreboard.jsx";
import { FibbagePhaseAnnouncer } from "./components/FibbagePhaseAnnouncer.jsx";
import { FibbagePlayHeader } from "./components/FibbagePlayHeader.jsx";
import { FibbageFeedbackOverlay } from "./components/FibbageFeedbackOverlay.jsx";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";

export function FibbagePlay() {
  return (
    <FibbageFeedbackProvider>
      <FibbagePlayInner />
    </FibbageFeedbackProvider>
  );
}

function FibbagePlayInner() {
  const router = useRouter();
  const { room, leaveRoom, roomUpdateReason } = useFibbage();
  const { message: feedbackMessage, feedback, flash } = useFibbageFeedback();
  const game = room?.game;
  const status = game?.status;
  const lastReasonRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!roomUpdateReason || roomUpdateReason === lastReasonRef.current) return;
    lastReasonRef.current = roomUpdateReason;
    if (roomUpdateReason === "writing_complete") {
      flash("Everyone's in!", "win");
    } else if (roomUpdateReason === "voting_complete") {
      flash("All votes are in!", "vote");
    }
  }, [roomUpdateReason, flash]);

  const topHighlight =
    status === "scoring" && Array.isArray(game?.roundHighlights) && game.roundHighlights.length > 0
      ? game.roundHighlights[0]
      : null;

  const {
    confirmOpen: leaveConfirmOpen,
    leaving: leavePending,
    requestLeave,
    cancelLeave,
    confirmLeave,
  } = useLeaveLobby({
    leaveRoom,
    onLeft: () => router.replace(FIBBAGE_PATHS.entry),
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <FibbagePhaseAnnouncer status={status} topHighlight={topHighlight} />
      <FibbagePlayHeader onLeave={requestLeave} />
      <FibbageHost status={status} />
      <div className="adaptive-content-anchored flex flex-1 flex-col md:flex-row md:items-stretch">
        <main className="flex-1 px-4 py-4 pb-24 md:pb-4">
          <LayoutGroup id="fibbage-play">
            <PhaseContent status={status} />
          </LayoutGroup>
        </main>
        <FibbageScoreRail players={room?.players ?? []} />
      </div>
      <FibbageFeedbackOverlay
        message={feedback?.message ?? feedbackMessage}
        type={feedback?.type ?? "default"}
        show={Boolean(feedback?.message ?? feedbackMessage)}
      />

      <LeaveLobbyDialog
        open={leaveConfirmOpen}
        title="Leave game?"
        description="You'll be removed from the game in progress. This can't be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        leaving={leavePending}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

/**
 * @param {{ status?: string }} props
 */
function PhaseContent({ status }) {
  const reduce = useReducedMotion();
  const motionProps = phaseEnter(reduce);
  const phaseKey = resolvePhaseKey(status);

  return (
    <AnimatePresence mode="wait">
      {phaseKey ? (
        <motion.div key={phaseKey} className="w-full" {...motionProps}>
          {renderPhase(status)}
        </motion.div>
      ) : (
        <motion.div
          key="loading"
          className="flex min-h-[40dvh] items-center justify-center"
          {...motionProps}
        >
          <FibbagePhaseLoading />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * @param {string | undefined} status
 */
function resolvePhaseKey(status) {
  if (!status) return null;
  if (status === "starting" || status === "prompt_reveal") return "prompt";
  if (status === "scoring" || status === "between_rounds") return "score";
  return status;
}

/**
 * @param {string | undefined} status
 */
function renderPhase(status) {
  switch (status) {
    case "starting":
    case "prompt_reveal":
      return <FibbagePromptReveal />;
    case "writing":
      return <FibbageWritingPanel />;
    case "voting":
      return <FibbageVotingGrid />;
    case "revealing":
      return <FibbageRevealStage />;
    case "scoring":
    case "between_rounds":
      return <FibbageScoreboard />;
    default:
      return <FibbagePhaseLoading />;
  }
}

function FibbagePhaseLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4" aria-busy="true" aria-label="Loading game phase">
      <div className="fibbage-skeleton h-8 w-32 mx-auto" />
      <div className="fibbage-skeleton h-40 w-full rounded-2xl" />
      <div className="fibbage-skeleton h-3 w-full max-w-xs mx-auto" />
    </div>
  );
}
