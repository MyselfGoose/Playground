"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

/**
 * @param {{ code: string, size?: 'lg' | 'md', className?: string }} props
 */
export function RoomCodeChip({ code, size = "lg", className = "" }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
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

  const isLarge = size === "lg";

  return (
    <motion.button
      type="button"
      onClick={() => void copy()}
      whileTap={{ scale: 0.98 }}
      className={`group flex items-center justify-center gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent-sky/10 px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-primary/20 transition hover:border-primary/50 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      aria-label={copied ? "Room code copied" : `Copy room code ${code}`}
    >
      <span
        className={`font-mono font-black tracking-[0.25em] text-primary ${isLarge ? "text-4xl sm:text-5xl" : "text-2xl"}`}
      >
        {code}
      </span>
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25 ${isLarge ? "h-11 w-11" : "h-9 w-9"}`}
      >
        {copied ? <Check className={isLarge ? "h-5 w-5" : "h-4 w-4"} aria-hidden /> : <Copy className={isLarge ? "h-5 w-5" : "h-4 w-4"} aria-hidden />}
      </span>
    </motion.button>
  );
}
