"use client";

import { motion } from "framer-motion";
import { cn } from "../../../../lib/taboo/cn.js";
import { motionPresets } from "../../../../lib/taboo/motion.js";
import { tabooTeamColors } from "../../../../lib/taboo/variants.js";
import { TabooTimer } from "./TabooTimer.jsx";

/**
 * @param {{
 *   game: object,
 *   room: object,
 *   localUserId: string | null,
 *   secondsRemaining: number,
 *   normalizedStatus: string,
 *   reduceMotion: boolean,
 * }} props
 */
export function TabooScoreHeader({ game, room, localUserId, secondsRemaining, normalizedStatus, reduceMotion }) {
  const colorsA = tabooTeamColors("A");
  const colorsB = tabooTeamColors("B");
  const currentPlayer = room?.players?.find((p) => p.id === localUserId) ?? null;
  const roundDuration = room?.settings?.roundDurationSeconds ?? 60;
  const timerPercent =
    normalizedStatus === "turn_in_progress" && roundDuration > 0
      ? (secondsRemaining / roundDuration) * 100
      : 0;

  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      <motion.div
        key={`score-a-${scoreA}`}
        className={cn(
          "rounded-xl p-3 transition-all duration-300",
          game?.activeTeam === "A" ? colorsA.activeScoreBg : colorsA.inactiveScoreBg,
        )}
        {...(reduceMotion ? {} : motionPresets.scorePop)}
      >
        <p className="mb-1 taboo-text-micro text-taboo-text-faint">Alpha</p>
        <p className="font-display text-2xl font-bold text-taboo-text" aria-live="polite">
          {scoreA}
        </p>
        {currentPlayer?.team === "A" ? <p className={cn("text-[10px]", colorsA.youText)}>You</p> : null}
      </motion.div>

      <TabooTimer
        secondsRemaining={secondsRemaining}
        timerPercent={timerPercent}
        active={normalizedStatus === "turn_in_progress"}
        activeTeam={game?.activeTeam === "B" ? "B" : "A"}
        reduceMotion={reduceMotion}
      />

      <motion.div
        key={`score-b-${scoreB}`}
        className={cn(
          "rounded-xl p-3 transition-all duration-300",
          game?.activeTeam === "B" ? colorsB.activeScoreBg : colorsB.inactiveScoreBg,
        )}
        {...(reduceMotion ? {} : motionPresets.scorePop)}
      >
        <p className="mb-1 text-right taboo-text-micro text-taboo-text-faint">Beta</p>
        <p className="text-right font-display text-2xl font-bold text-taboo-text" aria-live="polite">
          {scoreB}
        </p>
        {currentPlayer?.team === "B" ? <p className={cn("text-right text-[10px]", colorsB.youText)}>You</p> : null}
      </motion.div>
    </div>
  );
}
