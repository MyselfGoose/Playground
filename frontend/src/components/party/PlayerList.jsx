"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { Avatar } from "../Avatar.jsx";
import { PlayerPresenceBadge } from "./PlayerPresenceBadge.jsx";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   avatarUrl?: string | null,
 *   avatarEmoji?: string | null,
 *   ready?: boolean,
 *   connected?: boolean,
 *   presenceStatus?: string,
 *   graceEndsAtMs?: number | null,
 *   graceSecondsRemaining?: number,
 *   isHost?: boolean,
 * }} PartyPlayer
 */

/**
 * @param {PartyPlayer[]} players
 * @returns {PartyPlayer[]}
 */
function dedupePlayersById(players) {
  const seen = new Set();
  return players.filter((player) => {
    const id = String(player.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * @param {{
 *   players: PartyPlayer[],
 *   localUserId?: string | null,
 *   className?: string,
 *   layout?: 'vertical' | 'horizontal',
 * }} props
 */
export const PlayerList = memo(function PlayerList({
  players,
  localUserId = null,
  className = "",
  layout = "vertical",
}) {
  const uniquePlayers = useMemo(() => dedupePlayersById(players), [players]);

  if (layout === "horizontal") {
    return (
      <ul className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
        <AnimatePresence initial={false}>
          {uniquePlayers.map((p, i) => {
            const isMe = localUserId != null && p.id === localUserId;
            const pending = p.presenceStatus === "disconnect_pending";
            const disconnected = p.presenceStatus === "gone" || (p.connected === false && !pending);
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className={`flex min-w-[9rem] shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 ${
                  pending
                    ? "border-amber-500/35 bg-amber-500/10"
                    : disconnected
                      ? "border-foreground/10 bg-muted-bright/10 opacity-60"
                      : p.ready
                        ? "border-accent-mint/40 bg-accent-mint/10"
                        : "border-foreground/10 bg-background/80"
                }`}
              >
                <Avatar
                  username={p.name}
                  src={p.avatarUrl ?? undefined}
                  emoji={p.avatarEmoji ?? undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {p.name}
                    {isMe ? <span className="text-foreground/50"> (you)</span> : null}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-foreground/55">
                    {pending ? "Reconnecting…" : disconnected ? "Left" : p.ready ? "Ready" : "Not ready"}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      <AnimatePresence initial={false}>
        {uniquePlayers.map((p, i) => {
          const isMe = localUserId != null && p.id === localUserId;
          const pending = p.presenceStatus === "disconnect_pending";
          const disconnected = p.presenceStatus === "gone" || (p.connected === false && !pending);
          return (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                pending
                  ? "border-amber-500/35 bg-amber-500/10 opacity-90"
                  : disconnected
                  ? "border-foreground/10 bg-muted-bright/10 opacity-60"
                  : p.ready
                    ? "border-accent-mint/40 bg-accent-mint/10 ring-1 ring-accent-mint/30"
                    : "border-foreground/10 bg-background/80"
              }`}
            >
              <Avatar
                username={p.name}
                src={p.avatarUrl ?? undefined}
                emoji={p.avatarEmoji ?? undefined}
                size="sm"
              />
              <motion.div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">
                  {p.name}
                  {isMe ? <span className="text-foreground/50"> (you)</span> : null}
                </p>
                <p className="text-xs font-semibold text-foreground/55">
                  {pending ? (
                    <PlayerPresenceBadge
                      presenceStatus={p.presenceStatus}
                      graceEndsAtMs={p.graceEndsAtMs}
                      graceSecondsRemaining={p.graceSecondsRemaining}
                    />
                  ) : disconnected ? (
                    "Left"
                  ) : p.ready ? (
                    "Ready"
                  ) : (
                    "Not ready"
                  )}
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
