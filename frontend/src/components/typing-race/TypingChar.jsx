"use client";

import { forwardRef, memo } from "react";

/**
 * Single inline character — must stay `display: inline` for stable line boxes.
 *
 * @typedef {{ ch: string; state: 'correct'|'error'|'pending'|'current'; id: string }} TypingCharProps
 */

const TypingCharInner = forwardRef(
  /**
   * @param {TypingCharProps & { className?: string }} props
   * @param {React.Ref<HTMLSpanElement>} ref
   */
  ({ ch, state, id, className = "" }, ref) => {
    const cls = {
      correct: "tt-char tt-char--correct",
      error: "tt-char tt-char--error",
      pending: "tt-char tt-char--pending",
      current: "tt-char tt-char--current",
    }[state];

    /** Regular space so lines can break between words; monospace remains aligned */
    const display = ch;

    return (
      <span
        ref={ref}
        className={`${cls} ${className}`.trim()}
        data-char-state={state}
        data-char-id={id}
      >
        {display}
      </span>
    );
  },
);

TypingCharInner.displayName = "TypingCharInner";

export const TypingChar = memo(TypingCharInner);
