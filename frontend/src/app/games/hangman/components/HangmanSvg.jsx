"use client";

/** Gallows + up to 7 body segments based on wrong guesses vs max allowed. */
export function HangmanSvg({ stage, maxStage = 7, className = "" }) {
  const max = Math.max(1, maxStage);
  const st = Math.min(Math.max(0, stage), max);
  const n = 7;
  const partsToShow = Math.min(n, Math.ceil((st / max) * n));

  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
        <line x1="20" y1="125" x2="100" y2="125" />
        <line x1="35" y1="125" x2="35" y2="25" />
        <line x1="35" y1="25" x2="85" y2="25" />
        <line x1="85" y1="25" x2="85" y2="45" />
        {partsToShow >= 1 ? <circle cx="85" cy="52" r="8" /> : null}
        {partsToShow >= 2 ? <line x1="85" y1="60" x2="85" y2="95" /> : null}
        {partsToShow >= 3 ? <line x1="85" y1="72" x2="68" y2="58" /> : null}
        {partsToShow >= 4 ? <line x1="85" y1="72" x2="102" y2="58" /> : null}
        {partsToShow >= 5 ? <line x1="85" y1="95" x2="72" y2="118" /> : null}
        {partsToShow >= 6 ? <line x1="85" y1="95" x2="98" y2="118" /> : null}
        {partsToShow >= 7 ? <path d="M78 48 Q85 52 92 48" strokeWidth="2" /> : null}
      </g>
    </svg>
  );
}
