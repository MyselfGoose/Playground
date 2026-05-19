"use client";

import { motion } from "framer-motion";
import { Avatar } from "../../../../components/Avatar.jsx";

/**
 * @param {{
 *   activeUsername: string,
 *   isMyTurn: boolean,
 *   secondsRemaining?: number,
 * }} props
 */
export function TurnBanner({ activeUsername, isMyTurn, secondsRemaining }) {
  return (
    <motion.div
      layout
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
        isMyTurn
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/25"
          : "border-foreground/10 bg-muted-bright/20"
      }`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Avatar username={activeUsername} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-foreground">
          {isMyTurn ? "Your turn — pick a letter" : `${activeUsername}'s turn`}
        </p>
        {typeof secondsRemaining === "number" && secondsRemaining > 0 ? (
          <p className="text-xs font-semibold text-foreground/55">{secondsRemaining}s remaining</p>
        ) : null}
      </div>
      {isMyTurn ? (
        <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-black uppercase text-white">
          You
        </span>
      ) : null}
    </motion.div>
  );
}
