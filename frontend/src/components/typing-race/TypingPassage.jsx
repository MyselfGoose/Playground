"use client";

import { memo } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * @param {{
 *   passage: string;
 *   cursor: number;
 *   errorStack: string;
 * }} props
 */
function TypingPassageInner({ passage, cursor, errorStack }) {
  const reduce = useReducedMotion();
  const typed = passage.slice(0, cursor);
  const pending = passage.slice(cursor);
  const caretMotion = reduce ? "" : " motion-safe:animate-pulse";

  return (
    <div className="typing-passage-wrap mx-auto max-w-4xl px-2 py-6 text-left sm:px-4">
      <p className="whitespace-pre-wrap break-words font-mono text-lg tracking-wide sm:text-xl">
        <span className="text-[var(--tt-correct)]">{typed}</span>
        <span className="text-[var(--tt-error)]">{errorStack}</span>
        <span
          aria-hidden
          className={`typing-caret inline-block h-[1.15em] w-px translate-y-[0.08em] bg-[var(--tt-caret)] align-top${caretMotion}`}
        />
        <span className="text-[var(--tt-pending)]">{pending}</span>
      </p>
    </div>
  );
}

export const TypingPassage = memo(TypingPassageInner);
