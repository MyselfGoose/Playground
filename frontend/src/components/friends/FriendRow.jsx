"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Avatar } from "../Avatar.jsx";

/**
 * @param {{
 *   friend: { userId: string, username: string, avatarUrl: string, online: boolean },
 *   onNavigate?: () => void,
 * }} props
 */
export function FriendRow({ friend, onNavigate }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl transition-colors hover:bg-muted-bright/40"
    >
      <Link
        href={`/profile/${friend.userId}`}
        onClick={onNavigate}
        className="flex items-center gap-2 px-1.5 py-1.5"
      >
        <span className="relative shrink-0">
          <Avatar username={friend.username} src={friend.avatarUrl} size="sm" />
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
              friend.online ? "bg-accent-mint" : "bg-muted"
            }`}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{friend.username}</span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted">
          {friend.online ? "Online" : "Offline"}
        </span>
      </Link>
    </motion.li>
  );
}
