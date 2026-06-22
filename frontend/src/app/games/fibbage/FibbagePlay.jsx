"use client";

import { useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
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
import { FIBBAGE_PATHS } from "./fibbage-shared.js";

export function FibbagePlay() {
  const router = useRouter();
  const { room, leaveRoom } = useFibbage();
  const game = room?.game;
  const status = game?.status;

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
    <div className="flex min-h-[100dvh] flex-col">
      <FibbagePhaseAnnouncer status={status} />
      <FibbagePlayHeader onLeave={requestLeave} />
      <FibbageHost status={status} />
      <main className="flex-1 px-4 py-4">
        <PhaseContent status={status} />
      </main>
      <FibbageScoreRail players={room?.players ?? []} />

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

function PhaseContent({ status }) {
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
      return (
        <div className="flex min-h-[40dvh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fibbage-accent)] border-t-transparent" />
        </div>
      );
  }
}
