"use client";

import { motion } from "framer-motion";
import { Button } from "../Button.jsx";

/**
 * Unified “you still have an active room” prompt after session_resumed or reload.
 *
 * @param {{
 *   roomCode: string,
 *   lobbyHref: string,
 *   onRejoin: () => void,
 *   onLeave: () => void | Promise<void>,
 *   leaving?: boolean,
 * }} props
 */
export function RejoinRoomPrompt({ roomCode, lobbyHref, onRejoin, onLeave, leaving = false }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-col gap-4 rounded-[var(--radius-2xl)] border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent-pink/5 px-6 py-5 shadow-[var(--shadow-md)] ring-1 ring-primary/20 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">
        You still have an active game in room{" "}
        <span className="font-mono font-black tracking-[0.2em] text-primary">{roomCode}</span>
        . Rejoin to continue?
      </p>
      <div className="flex flex-shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          className="px-4 py-2 text-sm font-bold"
          onClick={onRejoin}
        >
          Rejoin
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-sm font-bold"
          disabled={leaving}
          onClick={() => void onLeave()}
        >
          {leaving ? "Leaving…" : "Leave"}
        </Button>
      </div>
      <a href={lobbyHref} className="sr-only">
        Rejoin room {roomCode}
      </a>
    </motion.div>
  );
}
