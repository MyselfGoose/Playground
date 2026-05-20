"use client";

import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { ResultGate } from "../../../../components/game-feel/WinnerBanner.jsx";
import { ResultActions } from "../../../../components/game/ResultActions.jsx";

/**
 * @param {{
 *   scoreRows: Array<{ uid: string, name: string, score: number }>,
 *   onPlayAgain: () => void,
 *   onReturnToLobby: () => void,
 *   onLeave: () => void,
 *   busy?: boolean,
 * }} props
 */
export function GameEndPanel({ scoreRows, onPlayAgain, onReturnToLobby, onLeave, busy }) {
  const top = scoreRows[0];
  const bannerTitle = top ? `${top.name} wins!` : "Game over";
  const bannerSubtitle = top ? `Top score: ${top.score.toFixed(0)}` : "Final standings";

  return (
    <ResultGate title={bannerTitle} subtitle={bannerSubtitle}>
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 to-accent-pink/10 p-6 ring-2 ring-primary/20"
    >
      <p className="text-2xl font-black text-foreground">Game over</p>
      <p className="mt-1 text-sm font-semibold text-foreground/65">Final standings</p>
      <ol className="mt-5 space-y-2">
        {scoreRows.map((row, i) => (
          <li
            key={row.uid}
            className={`flex justify-between rounded-xl px-4 py-2.5 font-bold transition-transform ${
              i === 0
                ? "scale-[1.02] bg-primary/20 ring-2 ring-primary/40"
                : "bg-background/85"
            }`}
          >
            <span>
              {i === 0 ? "🏆 " : null}#{i + 1} {row.name}
            </span>
            <span className="text-primary">{row.score.toFixed(0)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="primary" className="flex-1" disabled={busy} onClick={onPlayAgain}>
          Play again
        </Button>
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={onReturnToLobby}>
          Return to lobby
        </Button>
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={onLeave}>
          Leave
        </Button>
      </div>
      <ResultActions className="mt-6 border-t border-foreground/10 pt-6" />
    </motion.section>
    </ResultGate>
  );
}
