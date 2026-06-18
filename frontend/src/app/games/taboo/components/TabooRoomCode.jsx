"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Share2 } from "lucide-react";
import { buildInviteUrl } from "../../../../lib/party/buildInviteUrl.js";
import { cn } from "../../../../lib/taboo/cn.js";
import { TabooIconButton } from "../ui/index.js";

/**
 * @param {{
 *   code: string,
 *   gameSlug?: string,
 *   size?: "sm" | "lg",
 *   className?: string,
 * }} props
 */
export function TabooRoomCode({ code, gameSlug = "taboo", size = "lg", className = "" }) {
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
        title: "Join my Taboo game",
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

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 taboo-surface-raised taboo-glow-a px-5 py-4",
        className,
      )}
    >
      <span className={cn("font-mono font-black text-taboo-team-a-text", codeClass)}>{code}</span>
      <TabooIconButton
        aria-label={copied ? "Room code copied" : `Copy room code ${code}`}
        onClick={() => void copyCode()}
        className="text-taboo-team-a-text"
      >
        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      </TabooIconButton>
      {canShare ? (
        <TabooIconButton
          aria-label={`Share invite link for room ${code}`}
          onClick={() => void shareLink()}
          className="text-taboo-team-a-text"
        >
          <Share2 className="h-5 w-5" />
        </TabooIconButton>
      ) : null}
    </motion.div>
  );
}
