"use client";

import { useCallback, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

export function FibbageVotingGrid() {
  const { room, castVote } = useFibbage();
  const game = room?.game;
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);

  const votingSeconds = room?.settings?.votingSeconds ?? 45;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, votingSeconds);
  const answers = game?.answers ?? [];
  const canVote = Boolean(game?.permissions?.canVote);
  const hasVoted = Boolean(game?.viewerVote);
  const votedUserIds = game?.votedUserIds ?? [];
  const ownAnswerId = game?.permissions?.ownAnswerId ?? null;

  const waitingFor = useMemo(() => {
    const activePlayers = room?.players?.filter((p) => p.connected !== false) ?? [];
    return activePlayers.filter((p) => !votedUserIds.includes(p.userId));
  }, [room?.players, votedUserIds]);

  const handleVote = useCallback(
    async (answerId) => {
      if (!canVote || pendingId || answerId === ownAnswerId) return;
      setPendingId(answerId);
      setError(null);
      try {
        const result = await castVote(answerId);
        if (result && !result.ok) {
          setError(result.error?.message ?? "Could not cast vote.");
        }
      } catch {
        setError("Could not cast vote.");
      } finally {
        setPendingId(null);
      }
    },
    [canVote, castVote, ownAnswerId, pendingId],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="fibbage-card text-center">
        <p className="text-sm text-[var(--fibbage-text-muted)]">Which answer is the truth?</p>
        <p className="mt-2 text-lg font-bold text-[var(--fibbage-text)]">{game?.prompt?.text}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {answers.map((answer) => {
          const isOwn = answer.answerId === ownAnswerId;
          const isSelected = game?.viewerVote === answer.answerId;
          const disabled = !canVote || pendingId !== null || isOwn;

          return (
            <button
              key={answer.answerId}
              type="button"
              disabled={disabled}
              onClick={() => void handleVote(answer.answerId)}
              className={`fibbage-card text-left transition ${
                isSelected ? "fibbage-card--selected" : ""
              } ${isOwn ? "fibbage-card--disabled" : ""}`}
            >
              <p className="font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
              {isOwn ? (
                <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-accent)]">Your lie</p>
              ) : null}
            </button>
          );
        })}
      </div>

      {hasVoted ? (
        <div className="fibbage-card text-center">
          <p className="font-bold text-[var(--fibbage-accent)]">Vote cast!</p>
          <p className="mt-2 text-sm text-[var(--fibbage-text-muted)]">
            Waiting for {waitingFor.length} player{waitingFor.length === 1 ? "" : "s"}…
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {waitingFor.map((player) => (
              <div key={player.userId} className="flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-1.5">
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size="sm"
                />
                <span className="text-xs font-semibold">{player.username}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm font-semibold text-[var(--fibbage-lie)]">{error}</p> : null}

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={votingSeconds} />

      <p className="text-center text-xs text-[var(--fibbage-text-muted)]">
        {votedUserIds.length} of {room?.players?.filter((p) => p.connected !== false).length ?? 0} voted
      </p>
    </div>
  );
}
