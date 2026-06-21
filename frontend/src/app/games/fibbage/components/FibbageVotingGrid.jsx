"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { FibbagePromptCard } from "./FibbagePromptCard.jsx";
import { TimerBar } from "../../../../components/game-feel/TimerBar.jsx";

export function FibbageVotingGrid() {
  const { room, castVote, localUserId } = useFibbage();
  const game = room?.game;
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);

  if (!game || game.status !== "voting") return null;

  const answers = game.answers ?? [];
  const viewerVote = game.viewerVote;
  const ownAnswerId = room.permissions?.ownAnswerId ?? null;
  const hasVoted = Boolean(viewerVote);

  async function handleVote(answerId) {
    if (hasVoted || voting || answerId === ownAnswerId) return;
    setVoting(true);
    setVoteError(null);
    const res = await castVote(answerId);
    if (!res.ok) setVoteError(res.error?.message ?? "Vote failed");
    setVoting(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <FibbagePromptCard
        text={game.prompt?.text}
        category={game.prompt?.category}
        round={game.round}
        totalRounds={room.settings?.roundCount}
      />

      {game.phaseEndsAt && <TimerBar endsAt={game.phaseEndsAt} />}

      <p className="text-center text-sm font-semibold text-[var(--fibbage-text-muted)]">
        {hasVoted
          ? "Vote locked in. Waiting for others..."
          : "Pick the answer you think is TRUE"}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AnimatePresence>
          {answers.map((a, idx) => {
            const isOwn = a.answerId === ownAnswerId;
            const isSelected = a.answerId === viewerVote;
            const isDisabled = hasVoted || isOwn || voting;

            return (
              <motion.button
                key={a.answerId}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.3 }}
                disabled={isDisabled}
                onClick={() => handleVote(a.answerId)}
                className={[
                  "fibbage-card text-left transition-all",
                  isSelected && "fibbage-card--selected",
                  isOwn && "fibbage-card--disabled",
                  !isDisabled && "cursor-pointer hover:scale-[1.02]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={isOwn ? "That's yours, cheater." : undefined}
              >
                <p className="text-sm font-bold leading-relaxed">{a.text}</p>
                {isOwn && (
                  <p className="mt-1 text-xs italic text-[var(--fibbage-text-muted)]">
                    Your lie — can&rsquo;t vote for it
                  </p>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {voteError && (
        <p className="text-center text-sm text-red-400">{voteError}</p>
      )}

      <div className="text-center text-xs text-[var(--fibbage-text-muted)]">
        {game.votedUserIds?.length ?? game.voteCount ?? 0} of{" "}
        {room.players?.length ?? 0} voted
      </div>
    </div>
  );
}
