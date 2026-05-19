"use client";

import { motion } from "framer-motion";
import { Avatar } from "../Avatar.jsx";
import { prettyDate } from "./profileUtils.js";

/**
 * @param {{
 *   username: string;
 *   avatarUrl?: string | null;
 *   createdAt?: string | null;
 *   email?: string | null;
 *   variant?: 'self' | 'public';
 *   metrics?: import('react').ReactNode;
 *   breakdown?: import('react').ReactNode;
 * }} props
 */
export function ProfileHero({
  username,
  avatarUrl,
  createdAt,
  email,
  variant = "public",
  metrics,
  breakdown,
}) {
  if (variant === "self") {
    return (
      <section className="bg-gradient-to-b from-muted-bright/20 to-transparent px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={false}
            className="flex flex-col items-center gap-6 text-center"
          >
            <Avatar username={username} src={avatarUrl} size="lg" />
            <motion.div initial={false}>
              <h1 className="text-4xl font-black text-foreground sm:text-5xl">{username}</h1>
              {email ? <p className="mt-2 text-foreground/60">{email}</p> : null}
            </motion.div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-primary/20 bg-gradient-to-br from-background/95 via-pastel-lavender/30 to-pastel-sky/25 p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-accent-purple/15 blur-3xl" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative z-[1] flex items-center gap-4 sm:gap-5">
          <Avatar username={username} src={avatarUrl} size="lg" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/55">Player profile</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-foreground sm:text-5xl">{username}</h1>
            <p className="mt-1.5 text-base font-semibold text-foreground/65">Joined {prettyDate(createdAt)}</p>
          </div>
        </div>
        {metrics ? <div className="relative z-[1]">{metrics}</div> : null}
      </div>
      {breakdown ? <div className="relative z-[1] mt-6">{breakdown}</div> : null}
    </motion.section>
  );
}
