"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { Avatar } from "../Avatar.jsx";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   avatarUrl?: string | null,
 *   ready?: boolean,
 *   connected?: boolean,
 *   isHost?: boolean,
 * }} PartyPlayer
 */

/**
 * @param {{
 *   players: PartyPlayer[],
 *   localUserId?: string | null,
 *   className?: string,
 * }} props
 */
export const PlayerList = memo(function PlayerList({ players, localUserId = null, className = "" }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      <AnimatePresence initial={false}>
        {players.map((p, i) => {
          const isMe = localUserId != null && p.id === localUserId;
          const disconnected = p.connected === false;
          return (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                disconnected
                  ? "border-foreground/10 bg-muted-bright/10 opacity-60"
                  : p.ready
                    ? "border-accent-mint/40 bg-accent-mint/10 ring-1 ring-accent-mint/30"
                    : "border-foreground/10 bg-background/80"
              }`}
            >
              <Avatar username={p.name} src={p.avatarUrl ?? undefined} size="sm" />
              <motion.div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">
                  {p.name}
                  {isMe ? <span className="text-foreground/50"> (you)</span> : null}
                </p>
                <p className="text-xs font-semibold text-foreground/55">
                  {disconnected ? "Disconnected" : p.ready ? "Ready" : "Not ready"}
                </p>
              </motion.div>
              {p.isHost ? (
                <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                  <Crown className="h-3 w-3" aria-hidden />
                  Host
                </span>
              ) : null}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
});
