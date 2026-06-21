"use client";

import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

export function FibbageScoreboard() {
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const roundScores = game?.roundScores ?? {};
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, 4);
  const isBetweenRounds = game?.status === "between_rounds";

  const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--fibbage-gold)]">
          {isBetweenRounds ? "Next round" : "Round scores"}
        </p>
        <h2 className="mt-2 text-2xl font-black text-[var(--fibbage-text)]">
          {isBetweenRounds ? "Get ready…" : `Round ${game?.round ?? 1} results`}
        </h2>
      </div>

      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const roundScore = roundScores[player.userId]?.totalRoundPoints ?? 0;
          return (
            <div
              key={player.userId}
              className="flex items-center gap-3 rounded-xl bg-[var(--fibbage-canvas-light)] px-4 py-3"
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
              {!isBetweenRounds && roundScore > 0 ? (
                <span className="text-sm font-bold text-[var(--fibbage-gold)]">+{roundScore}</span>
              ) : null}
              <span className="text-sm font-bold text-[var(--fibbage-text-muted)]">{player.score ?? 0}</span>
            </div>
          );
        })}
      </div>

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={4} />
    </div>
  );
}
