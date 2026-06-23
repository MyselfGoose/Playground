"use client";

import { motion } from "framer-motion";

export function BlackCardStage({ text, pick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-white/20 bg-black p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/70">Black Card</p>
      <p className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">{text || "Waiting for prompt..."}</p>
      <p className="mt-5 text-sm font-bold text-white/80">Pick {pick ?? 1}</p>
    </motion.div>
  );
}

/**
 * @param {{
 *   card: { sourceId: string, text?: string },
 *   selected?: boolean,
 *   disabled?: boolean,
 *   onClick?: () => void,
 *   tabIndex?: number,
 *   ariaLabel?: string,
 *   onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void,
 *   cardRef?: React.Ref<HTMLButtonElement>,
 * }} props
 */
export function WhiteCard({
  card,
  selected,
  disabled,
  onClick,
  tabIndex = -1,
  ariaLabel,
  onKeyDown,
  cardRef,
}) {
  return (
    <motion.button
      ref={cardRef}
      type="button"
      whileHover={disabled ? undefined : { y: -6 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`min-h-[140px] sm:min-h-[190px] rounded-[22px] border p-4 text-left shadow-[0_18px_35px_rgba(0,0,0,0.15)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        selected
          ? "border-primary bg-primary/10 ring-2 ring-primary/35"
          : "border-black/10 bg-white text-black hover:border-black/30"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/55">White Card</p>
      <p className="mt-3 text-lg font-bold leading-snug text-black">{card?.text}</p>
    </motion.button>
  );
}
