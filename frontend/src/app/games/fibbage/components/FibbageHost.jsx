"use client";

import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";

const STATUS_LABELS = {
  starting: "Round starting",
  prompt_reveal: "Read the prompt",
  writing: "Writing phase",
  voting: "Voting phase",
  revealing: "Results",
  scoring: "Scoring",
  between_rounds: "Between rounds",
};

/**
 * @param {{ status?: string }} props
 */
export function FibbageHost({ status }) {
  const { room } = useFibbage();
  const game = room?.game;
  const label = status ? STATUS_LABELS[status] ?? "Fibbage" : "Fibbage";
  const category = game?.prompt?.category;
  const round = game?.round;
  const roundCount = room?.settings?.roundCount ?? 5;
  const multiplier = game?.roundMultiplier ?? 1;

  return (
    <header className="px-4 pt-4">
      <div className="fibbage-host-strip flex flex-wrap items-center justify-between gap-2">
        <span>{label}</span>
        <div className="flex flex-wrap items-center gap-3 text-xs normal-case tracking-normal">
          {typeof round === "number" ? (
            <span>
              Round {round}/{roundCount}
            </span>
          ) : null}
          {category ? <span className="capitalize">{category}</span> : null}
          {multiplier > 1 ? (
            <span className="text-[var(--fibbage-gold)]">{multiplier}x points</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
