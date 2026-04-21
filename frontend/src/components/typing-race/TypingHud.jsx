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
    <div className="flex flex-wrap items-end justify-center gap-6 px-4 py-3 font-mono text-sm">
      {engine.mode === "time" && m.remainingSec != null && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--tt-ink-muted)]">
            time
          </div>
          <div className="text-2xl tabular-nums text-[var(--tt-accent)]">
            {fmt(m.remainingSec)}
          </div>
        </div>
      )}
      <HudStat
        label="wpm"
        tooltip="(correct characters ÷ 5) per minute for elapsed time."
        value={fmt(m.wpm)}
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
      />
    </div>
  );
}

export const TypingHud = memo(TypingHudInner);

function HudStat({ label, value, tooltip, muted }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-0.5 text-[10px] uppercase tracking-widest text-[var(--tt-ink-muted)]">
        <span>{label}</span>
        <button
          type="button"
          title={tooltip}
          className="cursor-help rounded px-0.5 text-[9px] leading-none text-[var(--tt-accent)] hover:bg-[var(--tt-surface)]"
          aria-label={tooltip}
        >
          ?
        </button>
      </div>
      <div
        className={`text-2xl tabular-nums ${muted ? "text-[var(--tt-ink-muted)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
