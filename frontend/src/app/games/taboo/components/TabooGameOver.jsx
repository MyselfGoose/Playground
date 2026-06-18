"use client";

import { motion } from "framer-motion";
import { Share2, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { cn } from "../../../../lib/taboo/cn.js";
import { feedbackMotion, motionPresets } from "../../../../lib/taboo/motion.js";
import { tabooTeamColors } from "../../../../lib/taboo/variants.js";
import { TabooButton, TabooCard, TabooLink } from "../ui/index.js";
import { buildPlayerRecapRows } from "../taboo-shared.js";

export function TabooGameOver({
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
  const recapRows = buildPlayerRecapRows(players, game?.history);
  const history = game?.history || [];
  const totalCorrect = history.filter((e) => e.action === "submit_guess" && e.matched).length;
  const totalTaboo = history.filter((e) => e.action === "taboo_called").length;
  const totalSkips = history.filter((e) => e.action === "skip_card").length;
  const teamA = tabooTeamColors("A");
  const teamB = tabooTeamColors("B");

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareResult = useCallback(async () => {
    if (!canShare) return;
    const url = typeof window !== "undefined" ? window.location.href : undefined;
    try {
      await navigator.share({
        title: "Taboo on Playground",
        text: "I played Taboo on Playground",
        ...(url ? { url } : {}),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, [canShare]);

  return (
    <motion.div className="w-full max-w-sm" {...motionPresets.modal}>
      <TabooCard level={2} glow={winner === "A" ? "a" : winner === "B" ? "b" : "accent"} className="p-6 text-center">
        <motion.div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-taboo-warning to-taboo-warning-deep shadow-[var(--taboo-team-a-glow)]"
          animate={feedbackMotion.winnerGlow}
        >
          <Trophy className="h-7 w-7 text-white" />
        </motion.div>

        <h2 className="mb-1 font-display text-2xl font-bold text-taboo-text">Game Over!</h2>
        <p className="mb-5 text-sm text-taboo-text-muted">
          {winner === "tie" ? "It's a tie!" : `Team ${winner === "A" ? "Alpha" : "Beta"} wins!`}
        </p>

        <div className="mb-6 flex items-center justify-center gap-6">
          <motion.div
            className={cn("rounded-xl px-4 py-2", winner === "A" ? teamA.activeScoreBg : "taboo-surface-inset")}
            animate={winner === "A" ? feedbackMotion.winnerGlow : {}}
          >
            <p className="mb-1 text-xs text-taboo-text-faint">Alpha</p>
            <p className={cn("font-display text-3xl font-bold", winner === "A" ? teamA.text : "text-taboo-text")}>
              {scoreA}
            </p>
          </motion.div>
          <div className="text-lg text-taboo-text-faint">vs</div>
          <motion.div
            className={cn("rounded-xl px-4 py-2", winner === "B" ? teamB.activeScoreBg : "taboo-surface-inset")}
            animate={winner === "B" ? feedbackMotion.winnerGlow : {}}
          >
            <p className="mb-1 text-xs text-taboo-text-faint">Beta</p>
            <p className={cn("font-display text-3xl font-bold", winner === "B" ? teamB.text : "text-taboo-text")}>
              {scoreB}
            </p>
          </motion.div>
        </div>

        <TabooCard level={1} className="mb-6 p-4 text-left">
          <p className="mb-2 taboo-text-micro text-taboo-text-faint">Match summary</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-taboo-text-muted">
            <div>
              <p className="text-lg font-semibold text-taboo-success">{totalCorrect}</p>
              <p>Correct</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-taboo-warning">{totalSkips}</p>
              <p>Skips</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-taboo-danger-text">{totalTaboo}</p>
              <p>Taboos</p>
            </div>
          </div>
        </TabooCard>

        {recapRows.length > 0 ? (
          <TabooCard level={1} className="mb-6 max-h-40 overflow-y-auto px-3 py-2 text-left">
            <p className="mb-2 taboo-text-micro text-taboo-text-faint">Per player</p>
            <ul className="space-y-2 text-xs text-taboo-text-muted">
              {recapRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-1 border-b border-taboo-border-subtle pb-2 last:border-0">
                  <span className="font-semibold text-taboo-text">{row.name}</span>
                  <span>
                    +{row.correct} correct
                    {row.close ? ` · ${row.close} close` : ""}
                    {row.skips ? ` · ${row.skips} skip` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </TabooCard>
        ) : null}

        {canShare ? (
          <TabooButton variant="ghost" className="mb-3" onClick={() => void shareResult()}>
            <Share2 className="h-4 w-4" />
            Share result
          </TabooButton>
        ) : null}

        <div className="flex flex-col gap-3">
          {showInRoomRematch ? (
            <TabooButton variant="primary" onClick={onPlayAgain} disabled={playAgainDisabled} loading={playAgainDisabled}>
              Play again
            </TabooButton>
          ) : (
            <Link href="/games/taboo" className="block">
              <TabooButton variant="primary">Play again</TabooButton>
            </Link>
          )}
          <TabooButton variant="ghost" onClick={onLeave}>
            Leave game
          </TabooButton>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
          <TabooLink href="/leaderboard">View leaderboard</TabooLink>
          <TabooLink href="/profile">Your profile</TabooLink>
        </div>
      </TabooCard>
    </motion.div>
  );
}
