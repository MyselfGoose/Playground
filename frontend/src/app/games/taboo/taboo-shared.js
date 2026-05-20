"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MessageCircle,
  Mic,
  Play,
  SkipForward,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { ResultActions } from "../../../components/game/ResultActions.jsx";
import { ShareResultButton } from "../../../components/game/ShareResultButton.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { motionPresets } from "../../../lib/taboo/motion.js";
import { teamColors } from "../../../lib/taboo/variants.js";

export function normalizeCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

/** @param {string} base @param {string | null | undefined} code */
export function tabooPath(base, code) {
  const normalized = code ? normalizeCode(code) : "";
  return normalized ? `${base}?code=${normalized}` : base;
}

export function buildPlayerRecapRows(players, history) {
  const rows = new Map();
  for (const p of players || []) {
    rows.set(p.id, { id: p.id, name: p.name, team: p.team, correct: 0, close: 0, wrong: 0, skips: 0, taboos: 0 });
  }
  for (const entry of history || []) {
    if (!entry.playerId || !rows.has(entry.playerId)) continue;
    const row = rows.get(entry.playerId);
    if (entry.action === "submit_guess" && entry.matched) row.correct += 1;
    else if (entry.action === "submit_guess") row.wrong += 1;
    else if (entry.action === "close_guess") row.close += 1;
    else if (entry.action === "skip_card") row.skips += 1;
    else if (entry.action === "taboo_called") row.taboos += 1;
  }
  return [...rows.values()].sort((a, b) => b.correct - a.correct);
}

/** @param {{ scores?: { A?: number, B?: number } }} game */
export function tabooWinnerBannerTitle(game) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  if (scoreA > scoreB) return "Team Alpha wins!";
  if (scoreB > scoreA) return "Team Beta wins!";
  return "It's a tie!";
}

/** @param {{ scores?: { A?: number, B?: number } }} game */
export function tabooWinnerBannerSubtitle(game) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  return `Final score ${scoreA} – ${scoreB}`;
}

export function GameOverScreen({
  game,
  players,
  onLeave,
  onPlayAgain,
  playAgainDisabled = false,
  showInRoomRematch = false,
}) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  const winner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "tie";
  const teamA = teamColors("A");
  const teamB = teamColors("B");
  const recapRows = buildPlayerRecapRows(players, game?.history);

  return (
    <motion.div
      className="w-full max-w-sm rounded-2xl border border-foreground/10 bg-background/90 p-6 text-center shadow-[var(--shadow-card)]"
      {...motionPresets.modal}
    >
      <motion.div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-lemon to-primary">
        <Trophy className="h-7 w-7 text-white" />
      </motion.div>
      <h2 className="mb-1 text-2xl font-black text-foreground">Game Over!</h2>
      <p className="mb-5 text-sm font-semibold text-foreground/60">
        {winner === "tie" ? "It's a tie!" : `Team ${winner === "A" ? "Alpha" : "Beta"} wins!`}
      </p>
      <motion.div className="mb-6 flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/50">Alpha</p>
          <p className={cn("text-3xl font-black", winner === "A" ? teamA.pillText : "text-foreground")}>{scoreA}</p>
        </div>
        <div className="text-lg font-bold text-foreground/40">vs</div>
        <div className="text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/50">Beta</p>
          <p className={cn("text-3xl font-black", winner === "B" ? teamB.pillText : "text-foreground")}>{scoreB}</p>
        </div>
      </motion.div>
      {recapRows.length > 0 ? (
        <div className="mb-6 max-h-40 overflow-y-auto rounded-xl border border-foreground/10 bg-muted-bright/20 px-3 py-2 text-left">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50">Per player</p>
          <ul className="space-y-1.5 text-xs text-foreground/70">
            {recapRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-1 border-b border-foreground/5 pb-1.5 last:border-0">
                <span className="font-semibold text-foreground">{row.name}</span>
                <span>
                  +{row.correct} correct
                  {row.close ? ` · ${row.close} close` : ""}
                  {row.skips ? ` · ${row.skips} skip` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ShareResultButton gameLabel="Taboo" className="mb-3 w-full" />
      <ResultActions
        playAgainLabel="Play again"
        onPlayAgain={showInRoomRematch ? onPlayAgain : undefined}
        playAgainHref={showInRoomRematch ? undefined : "/games/taboo"}
        playAgainDisabled={playAgainDisabled}
        secondaryLabel="Leave game"
        onSecondary={onLeave}
      />
    </motion.div>
  );
}

export const ROLE_BADGES = {
  clue_giver: {
    icon: Mic,
    label: "You're the Clue Giver",
    className: "border-accent-sky/40 bg-pastel-sky/80 text-accent-sky dark:bg-accent-sky/15",
  },
  teammate_guesser: {
    icon: MessageCircle,
    label: "You're Guessing",
    className: "border-success/40 bg-pastel-mint/80 text-success dark:bg-success/15",
  },
  opponent_observer: {
    icon: Eye,
    label: "Monitoring for Taboo",
    className: "border-primary/40 bg-pastel-peach/80 text-primary dark:bg-primary/15",
  },
  spectator: {
    icon: Eye,
    label: "Watching",
    className: "border-foreground/15 bg-muted-bright/40 text-foreground/60",
  },
};

const phaseCardClass =
  "rounded-2xl border border-foreground/10 bg-background/90 p-5 text-center shadow-[var(--shadow-card)]";

/**
 * @param {{
 *   game: object,
 *   autoStartTurn?: boolean,
 *   turnStartHeld?: boolean,
 *   canStartTurn?: boolean,
 *   canHoldTurnStart?: boolean,
 *   onStartTurn?: () => void,
 *   onHoldTurnStart?: () => void,
 *   countdown?: number,
 *   startTurnDisabled?: boolean,
 * }} props
 */
export function PhasePanel({
  game,
  autoStartTurn = true,
  turnStartHeld = false,
  canStartTurn = false,
  canHoldTurnStart = false,
  onStartTurn,
  onHoldTurnStart,
  countdown = 0,
  startTurnDisabled = false,
}) {
  const activeName = game?.activeTurn?.playerName || "Player";
  const activeTeamLabel = game?.activeTeam === "B" ? "Beta" : "Alpha";
  const summary = game?.lastTurnSummary;

  if (game?.status === "waiting_to_start_turn") {
    const showManualStart = canStartTurn && (!autoStartTurn || turnStartHeld);
    const showAutoReady = canStartTurn && autoStartTurn && !turnStartHeld;

    return (
      <motion.div className={phaseCardClass}>
        <p className="mb-1 text-sm font-semibold text-foreground/75">Next turn</p>
        <h2 className="mb-2 text-xl font-black text-foreground">{activeName}</h2>
        <p className="mb-4 text-sm text-foreground/75">Team {activeTeamLabel}</p>
        {showManualStart ? (
          <button
            type="button"
            onClick={onStartTurn}
            disabled={startTurnDisabled}
            className="mx-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-accent-sky/40 bg-pastel-sky/80 px-4 text-sm font-bold text-accent-sky disabled:opacity-50 dark:bg-accent-sky/15"
          >
            <Play className="h-4 w-4" />
            Start Turn
          </button>
        ) : showAutoReady ? (
          <motion.div className="space-y-2">
            <p className="text-sm font-bold text-foreground">Get ready…</p>
            {countdown > 0 ? (
              <p className="text-2xl font-black tabular-nums text-primary">{countdown}</p>
            ) : null}
            {canHoldTurnStart ? (
              <button
                type="button"
                onClick={onHoldTurnStart}
                disabled={startTurnDisabled}
                className="text-xs font-semibold text-foreground/50 underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                Hold — start manually
              </button>
            ) : null}
          </motion.div>
        ) : startTurnDisabled ? (
          <p className="text-sm font-semibold text-warning">Reconnecting…</p>
        ) : (
          <p className="text-sm text-foreground/75">
            Waiting for {activeName}
            {countdown > 0 ? ` · starting in ${countdown}s` : ""}
          </p>
        )}
      </motion.div>
    );
  }

  if (game?.status === "between_turns") {
    return (
      <motion.div className={phaseCardClass}>
        {summary ? (
          <div className="mb-3">
            <p className="text-sm font-bold text-foreground">
              {summary.clueGiverName} scored{" "}
              <span className="text-success">{summary.correctGuesses}</span> point
              {summary.correctGuesses === 1 ? "" : "s"} for Team {summary.team === "B" ? "Beta" : "Alpha"}
            </p>
            {summary.taboos > 0 ? (
              <p className="mt-1 text-xs font-semibold text-primary">
                {summary.taboos} taboo {summary.taboos === 1 ? "penalty" : "penalties"}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="mb-2 text-sm text-foreground/75">Up next</p>
        <p className="text-base font-bold text-foreground">
          {activeName} from Team {activeTeamLabel}
        </p>
        <p className="mt-2 text-sm text-foreground/75">Starting in {countdown}s…</p>
      </motion.div>
    );
  }

  if (game?.status === "between_rounds") {
    return (
      <motion.div className={phaseCardClass}>
        <p className="mb-2 text-sm text-foreground/60">Round {game.roundNumber} complete</p>
        <div className="mb-3 flex items-center justify-center gap-4">
          <motion.div className="text-center">
            <p className="text-xs text-foreground/50">Alpha</p>
            <p className="text-lg font-black text-foreground">{game.scores?.A ?? 0}</p>
          </motion.div>
          <span className="text-foreground/40">vs</span>
          <motion.div className="text-center">
            <p className="text-xs text-foreground/50">Beta</p>
            <p className="text-lg font-black text-foreground">{game.scores?.B ?? 0}</p>
          </motion.div>
        </div>
        <p className="text-base font-bold text-foreground">
          Round {game.nextRoundNumber} starts in {countdown}s
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div className={phaseCardClass}>
      <p className="text-sm text-foreground/75">Synchronizing turn state</p>
    </motion.div>
  );
}

export const HISTORY_ICONS = {
  submit_guess_correct: CheckCircle2,
  submit_guess: XCircle,
  close_guess: MessageCircle,
  skip_card: SkipForward,
  taboo_called: AlertTriangle,
  review_vote: Users,
  review_resolved: CheckCircle2,
  turn_event: Clock,
};
