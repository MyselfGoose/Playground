"use client";

import { useTypingLiveMetrics } from "./useTypingLiveMetrics.js";
import { useTypingTest } from "./TypingTestContext.jsx";

export function ResultsPanel() {
  const { engine, nowMs, restart } = useTypingTest();
  const m = useTypingLiveMetrics(engine, nowMs);

  if (engine.status !== "completed") {
    return null;
  }

  const fmt = (n) =>
    Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "0.0";

  return (
    <div
      className="mx-auto mt-4 max-w-lg rounded-xl border border-[var(--tt-ink-muted)]/20 bg-[var(--tt-surface)]/90 px-6 py-8 text-center shadow-xl backdrop-blur-sm"
      role="region"
      aria-label="Test results"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--tt-ink-muted)]">
        Done
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-y-6 gap-x-10 text-left sm:grid-cols-2">
        <MetricBlurb
          label="wpm"
          tooltipId="tip-wpm"
          tooltip="Gross speed: (correct characters ÷ 5) per minute using elapsed time. Uses the standard “5 characters ≈ one word” rule."
          value={fmt(m.wpm)}
        />
        <MetricBlurb
          label="raw"
          tooltipId="tip-raw"
          tooltip="Characters per minute including mistakes: (correct + incorrect + extra) ÷ 5 per minute."
          value={fmt(m.rawWpm)}
        />
        <MetricBlurb
          label="accuracy"
          tooltipId="tip-acc"
          tooltip="correct ÷ (correct + incorrect + extra), as a percentage."
          value={`${fmt(m.accuracy)}%`}
        />
        <MetricBlurb
          label="errors"
          tooltipId="tip-err"
          tooltip="Incorrect keypresses plus extras typed past the end of the passage."
          value={String(m.errorCount)}
        />
      </div>
      <button
        type="button"
        className="mt-8 rounded-lg bg-[var(--tt-accent)]/30 px-6 py-3 text-sm font-semibold text-[var(--tt-ink)] ring-1 ring-[var(--tt-accent)]/40 transition hover:bg-[var(--tt-accent)]/45"
        onClick={restart}
      >
        Start again
      </button>
      <p className="mt-4 text-xs text-[var(--tt-ink-muted)]">
        Press{" "}
        <kbd className="rounded border border-[var(--tt-ink-muted)]/40 px-1 py-0.5">
          Enter
        </kbd>{" "}
        or{" "}
        <kbd className="rounded border border-[var(--tt-ink-muted)]/40 px-1 py-0.5">
          Tab
        </kbd>{" "}
        to restart
      </p>
    </div>
  );
}

function MetricBlurb({ label, value, tooltip, tooltipId, className = "" }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <span className="text-xs uppercase tracking-wide text-[var(--tt-ink-muted)]">
          {label}
        </span>
        <button
          type="button"
          className="cursor-help rounded p-0.5 text-[10px] leading-none text-[var(--tt-accent)] hover:bg-[var(--tt-surface)]"
          title={tooltip}
          id={tooltipId}
          aria-label={`Definition: ${label}`}
        >
          ?
        </button>
      </div>
      <div className="mt-1 font-mono text-2xl tabular-nums text-[var(--tt-ink)]">
        {value}
      </div>
    </div>
  );
}
