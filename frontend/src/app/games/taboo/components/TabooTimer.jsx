"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";
import { feedbackMotion } from "../../../../lib/taboo/motion.js";
import { teamColors } from "../../../../lib/taboo/variants.js";

/**
 * @param {{
 *   secondsRemaining: number,
 *   timerPercent: number,
 *   active: boolean,
 *   activeTeam?: 'A' | 'B',
 *   reduceMotion?: boolean,
 * }} props
 */
export function TabooTimer({
  secondsRemaining,
  timerPercent,
  active,
  activeTeam = "A",
  reduceMotion = false,
}) {
  const teamStyle = teamColors(activeTeam);
  const timerColor =
    secondsRemaining <= 10
      ? "text-taboo-danger"
      : secondsRemaining <= 20
        ? "text-taboo-warning"
        : "text-taboo-text";

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl taboo-surface-card p-3 text-center"
      animate={
        reduceMotion || !active
          ? {}
          : secondsRemaining <= 10
            ? feedbackMotion.timerUrgent
            : { scale: 1, filter: "brightness(1)" }
      }
    >
      {active ? (
        <div
          className={cn("absolute bottom-0 left-0 h-1 bg-gradient-to-r", teamStyle.timerBar)}
          style={{ width: `${Math.max(0, Math.min(100, timerPercent))}%`, transition: "width 0.3s ease" }}
        />
      ) : null}
      <Clock className="mx-auto mb-1 h-4 w-4 text-taboo-text-faint" />
      <p className={cn("font-mono text-2xl font-bold tabular-nums", timerColor)}>{secondsRemaining}</p>
    </motion.div>
  );
}
