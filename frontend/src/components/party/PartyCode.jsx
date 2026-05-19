"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Share2 } from "lucide-react";
import { buildInviteUrl } from "../../lib/party/buildInviteUrl.js";

/**
 * @param {{
 *   code: string,
 *   gameSlug: string,
 *   size?: 'sm' | 'lg',
 *   className?: string,
 * }} props
 */
export function PartyCode({ code, gameSlug, size = "lg", className = "" }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = useMemo(() => buildInviteUrl(gameSlug, code), [gameSlug, code]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const isLarge = size === "lg";

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  }, [code]);

  const shareLink = useCallback(async () => {
    if (!code || !canShare) return;
    try {
      await navigator.share({
        title: "Join my game",
        text: `Join with code ${code}`,
        url: inviteUrl,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      await copyCode();
    }
  }, [canShare, code, copyCode, inviteUrl]);

  const codeClass = isLarge
    ? "text-4xl sm:text-5xl tracking-[0.25em]"
    : "text-2xl tracking-[0.2em]";
  const iconBox = isLarge ? "h-11 w-11" : "h-9 w-9";
  const iconSize = isLarge ? "h-5 w-5" : "h-4 w-4";

  return (
    <motion.div
      layout
      className={`flex flex-wrap items-center justify-center gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent-sky/10 px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-primary/20 ${className}`}
    >
      <span className={`font-mono font-black text-primary ${codeClass}`}>{code}</span>
      <motion.button
        type="button"
        onClick={() => void copyCode()}
        whileTap={{ scale: 0.98 }}
        className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition hover:bg-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${iconBox}`}
        aria-label={copied ? "Room code copied" : `Copy room code ${code}`}
      >
        {copied ? (
          <Check className={iconSize} aria-hidden />
        ) : (
          <Copy className={iconSize} aria-hidden />
        )}
      </motion.button>
      {canShare ? (
        <motion.button
          type="button"
          onClick={() => void shareLink()}
          whileTap={{ scale: 0.98 }}
          className={`flex shrink-0 items-center justify-center rounded-xl bg-accent-sky/20 text-primary transition hover:bg-accent-sky/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${iconBox}`}
          aria-label={`Share invite link for room ${code}`}
        >
          <Share2 className={iconSize} aria-hidden />
        </motion.button>
      ) : null}
    </motion.div>
  );
}
