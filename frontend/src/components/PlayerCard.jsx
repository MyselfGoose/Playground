"use client";

import { motion } from "framer-motion";
import { Avatar } from "./Avatar.jsx";

export function PlayerCard({ 
  rank, 
  username, 
  score, 
  wins, 
  index,
  avatarUrl,
  variant = "compact"
}) {
  const getMedalEmoji = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.05,
        duration: 0.3,
      },
    },
  };

  if (variant === "compact") {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        whileHover={{ scale: 1.02, x: 4 }}
        className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-lg)] bg-gradient-to-r from-muted-bright/20 to-transparent ring-1 ring-muted-bright/40 hover:ring-primary/40 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3 min-w-[4rem]">
            {getMedalEmoji(rank) && (
              <span className="text-2xl">{getMedalEmoji(rank)}</span>
            )}
            <span className="text-lg font-extrabold text-foreground/60 w-8 text-center">
              #{rank}
            </span>
          </div>
          <Avatar username={username} src={avatarUrl} size="sm" />
          <div>
            <div className="font-bold text-foreground text-sm">{username}</div>
            <div className="text-xs text-muted">{wins} wins</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">
            {score}
          </div>
          <div className="text-xs text-muted font-bold uppercase">points</div>
        </div>
      </motion.div>
    );
  }

  // Full card variant
  return (
    <motion.article
      variants={containerVariants}
      initial="hidden"
      animate="show"
      whileHover={{ y: -8 }}
      className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-muted-bright/30 to-transparent p-6 ring-2 ring-muted-bright/40 text-center"
    >
      <div className="mb-4 flex justify-center">
        {getMedalEmoji(rank) && (
          <span className="text-5xl">{getMedalEmoji(rank)}</span>
        )}
        {!getMedalEmoji(rank) && (
          <div className="text-4xl font-extrabold text-primary">#{rank}</div>
        )}
      </div>
      
      <div className="mb-4 flex justify-center">
        <Avatar username={username} src={avatarUrl} size="md" />
      </div>
      
      <h3 className="font-bold text-foreground text-lg mb-1">{username}</h3>
      
      <div className="space-y-2 mt-4 pt-4 border-t border-muted-bright/40">
        <div>
          <div className="text-3xl font-extrabold bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">
            {score}
          </div>
          <div className="text-xs text-muted font-bold uppercase">Points</div>
        </div>
        <div>
          <div className="text-xl font-bold text-foreground">{wins}</div>
          <div className="text-xs text-muted font-bold uppercase">Wins</div>
        </div>
      </div>
    </motion.article>
  );
}
