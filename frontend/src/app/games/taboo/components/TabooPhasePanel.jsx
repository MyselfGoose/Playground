"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { TabooButton, TabooCard } from "../ui/index.js";

/**
 * @param {{
 *   game: object,
 *   canStartTurn?: boolean,
 *   canStartRound?: boolean,
 *   onStartTurn?: () => void,
 *   onStartRound?: () => void,
 *   countdown?: number,
 *   startTurnDisabled?: boolean,
 * }} props
 */
export function TabooPhasePanel({
  game,
  canStartTurn = false,
  canStartRound = false,
  onStartTurn,
  onStartRound,
  countdown = 0,
  startTurnDisabled = false,
}) {
  const activeName = game?.activeTurn?.playerName || "Player";
  const activeTeamLabel = game?.activeTeam === "B" ? "Beta" : "Alpha";
  const summary = game?.lastTurnSummary;

  if (game?.status === "waiting_to_start_turn") {
    return (
      <TabooCard level={1} className="p-5 text-center">
        <p className="mb-1 text-sm text-[var(--taboo-text-secondary)]">Next turn</p>
        <h2 className="mb-2 font-display text-xl font-bold text-[var(--taboo-text)]">{activeName}</h2>
        <p className="mb-4 text-sm text-[var(--taboo-text-tertiary)]">Team {activeTeamLabel}</p>
        {canStartTurn ? (
          <TabooButton
            variant="primary"
            className="mx-auto !w-auto px-6"
            onClick={onStartTurn}
            disabled={startTurnDisabled}
          >
            <Play className="h-4 w-4" />
            Start turn
          </TabooButton>
        ) : startTurnDisabled ? (
          <p className="text-sm font-semibold text-taboo-warning">Reconnecting…</p>
        ) : (
          <motion.p
            className="text-sm text-[var(--taboo-text-secondary)]"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Waiting for {activeName} to start their turn
          </motion.p>
        )}
      </TabooCard>
    );
  }

  if (game?.status === "between_turns") {
    return (
      <TabooCard level={1} className="p-5 text-center">
        {summary ? (
          <div className="mb-3">
            <p className="text-sm font-semibold text-[var(--taboo-text)]">
              {summary.clueGiverName} scored{" "}
              <span className="text-taboo-success">{summary.correctGuesses}</span> point
              {summary.correctGuesses === 1 ? "" : "s"} for Team {summary.team === "B" ? "Beta" : "Alpha"}
            </p>
            {summary.taboos > 0 ? (
              <p className="mt-1 text-xs font-medium text-taboo-danger-text">
                {summary.taboos} taboo {summary.taboos === 1 ? "penalty" : "penalties"}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="mb-2 text-sm text-[var(--taboo-text-secondary)]">Up next</p>
        <p className="text-base font-semibold text-[var(--taboo-text)]">
          {activeName} from Team {activeTeamLabel}
        </p>
        <p className="mt-2 text-sm text-[var(--taboo-text-tertiary)]">
          {countdown > 0 ? `Brief pause · ${countdown}s` : "Get ready…"}
        </p>
      </TabooCard>
    );
  }

  if (game?.status === "between_rounds") {
    return (
      <TabooCard level={1} className="p-5 text-center">
        <p className="mb-2 text-sm text-[var(--taboo-text-secondary)]">Round {game.roundNumber} complete</p>
        <div className="mb-3 flex items-center justify-center gap-4">
          <div className="text-center">
            <p className="text-xs text-[var(--taboo-text-tertiary)]">Alpha</p>
            <p className="text-lg font-bold text-[var(--taboo-text)]">{game.scores?.A ?? 0}</p>
          </div>
          <span className="text-[var(--taboo-text-tertiary)]">vs</span>
          <div className="text-center">
            <p className="text-xs text-[var(--taboo-text-tertiary)]">Beta</p>
            <p className="text-lg font-bold text-[var(--taboo-text)]">{game.scores?.B ?? 0}</p>
          </div>
        </div>
        <p className="text-base font-semibold text-[var(--taboo-text)]">
          Round {game.nextRoundNumber} ready
        </p>
        <p className="mt-1 text-xs text-[var(--taboo-text-tertiary)]">The next clue giver starts the round</p>
        {canStartRound ? (
          <TabooButton
            variant="primary"
            className="mx-auto mt-4 !w-auto px-6"
            onClick={onStartRound}
            disabled={startTurnDisabled}
          >
            <Play className="h-4 w-4" />
            Start round
          </TabooButton>
        ) : startTurnDisabled ? (
          <p className="mt-4 text-sm font-semibold text-taboo-warning">Reconnecting…</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--taboo-text-secondary)]">Waiting for the next clue giver…</p>
        )}
      </TabooCard>
    );
  }

  return (
    <TabooCard level={1} className="p-5 text-center">
      <p className="text-sm text-[var(--taboo-text-secondary)]">Synchronizing turn state</p>
    </TabooCard>
  );
}
