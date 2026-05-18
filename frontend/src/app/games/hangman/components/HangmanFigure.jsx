"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HANGMAN_MAX_WRONG } from "../constants.js";

/**
 * Six-stage hangman figure (head, body, arms, legs).
 * @param {{ wrongCount: number, className?: string }} props
 */
export function HangmanFigure({ wrongCount, className = "" }) {
  const reduceMotion = useReducedMotion();
  const stage = Math.min(Math.max(0, wrongCount), HANGMAN_MAX_WRONG);

  const part = (show, d, key) =>
    show ? (
      <motion.g
        key={key}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        {d}
      </motion.g>
    ) : null;

  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
        <line x1="20" y1="125" x2="100" y2="125" />
        <line x1="35" y1="125" x2="35" y2="25" />
        <line x1="35" y1="25" x2="85" y2="25" />
        <line x1="85" y1="25" x2="85" y2="45" />
        {part(stage >= 1, <circle cx="85" cy="52" r="8" />, "head")}
        {part(stage >= 2, <line x1="85" y1="60" x2="85" y2="95" />, "body")}
        {part(stage >= 3, <line x1="85" y1="72" x2="68" y2="58" />, "arm-l")}
        {part(stage >= 4, <line x1="85" y1="72" x2="102" y2="58" />, "arm-r")}
        {part(stage >= 5, <line x1="85" y1="95" x2="72" y2="118" />, "leg-l")}
        {part(stage >= 6, <line x1="85" y1="95" x2="98" y2="118" />, "leg-r")}
      </g>
    </svg>
  );
}
