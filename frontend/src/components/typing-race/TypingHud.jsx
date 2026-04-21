"use client";

import { memo } from "react";
import { useTypingLiveMetrics } from "./useTypingLiveMetrics.js";
import { useTypingTest } from "./TypingTestContext.jsx";

function TypingHudInner() {
  const { engine, nowMs } = useTypingTest();
  const m = useTypingLiveMetrics(engine, nowMs);

  const fmt = (n) =>
    Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "0.0";

  return (
    <div className="typing-race-focus-keep mx-auto mt-2 w-full max-w-3xl px-4">
      <div className="flex flex-wrap items-stretch justify-center gap-1 rounded-[var(--tt-radius-lg)] border border-[var(--tt-ink-muted)]/15 bg-[var(--tt-bg-elevated)]/85 px-3 py-3 shadow-[var(--tt-shadow-soft)] backdrop-blur-md sm:gap-2 sm:px-4">
        {engine.mode === "time" && m.remainingSec != null && (
          <HudStat
            label="time"
            tooltip="Seconds remaining in this timed test."
            value={fmt(m.remainingSec)}
            accent
            emphasize
          />
        )}
        <HudStat
          label="wpm"
          tooltip="(correct characters ÷ 5) per minute for elapsed time."
          value={fmt(m.wpm)}
          emphasize
        />
        <HudStat
          label="raw"
          tooltip="All character counts including mistakes, ÷ 5 per minute."
          value={fmt(m.rawWpm)}
          muted
        />
        <HudStat
          label="acc"
          tooltip="correct ÷ (correct + incorrect + extra)."
          value={`${fmt(m.accuracy)}%`}
        />
        <HudStat
          label="err"
          tooltip="Incorrect keys plus extras past the end of the text."
          value={String(m.errorCount)}
          muted
        />
      </div>
    </div>
  );
}

export const TypingHud = memo(TypingHudInner);

function valueTone({ muted, accent, emphasize }) {
  if (muted) {
    return "text-[var(--tt-ink-muted)]";
  }
  if (accent) {
    return "text-[var(--tt-accent)]";
  }
  if (emphasize) {
    return "text-[var(--tt-ink-strong)]";
  }
  return "text-[var(--tt-ink)]";
}

function HudStat({
  label,
  value,
  tooltip,
  muted,
  accent,
  emphasize,
}) {
  return (
    <div
      className={`font-sans flex min-w-[4.5rem] flex-1 flex-col rounded-[var(--tt-radius-md)] px-2 py-1.5 text-center transition-colors duration-200 sm:min-w-[5.5rem] sm:px-3 ${
        emphasize
          ? "bg-[rgb(124_108_240_/0.1)] ring-1 ring-[rgb(124_108_240_/0.18)]"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center justify-center gap-1">
        <span
          className={`text-[9px] font-semibold uppercase tracking-[0.14em] sm:text-[10px] ${
            accent ? "text-[var(--tt-accent)]" : "text-[var(--tt-ink-muted)]"
          }`}
        >
          {label}
        </span>
        <button
          type="button"
          title={tooltip}
          className="cursor-help rounded px-0.5 text-[8px] leading-none text-[var(--tt-accent-soft)] opacity-70 hover:bg-[rgb(124_108_240_/0.08)] hover:opacity-100"
          aria-label={tooltip}
        >
          ?
        </button>
      </div>
      <div
        className={`mt-0.5 font-mono text-xl tabular-nums leading-none tracking-tight sm:text-2xl ${valueTone(
          { muted, accent, emphasize },
        )}`}
      >
        {value}
      </div>
    </div>
  );
}
