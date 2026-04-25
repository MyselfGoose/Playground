"use client";

import { useTypingLiveMetrics } from "./useTypingLiveMetrics.js";
import { useTypingTest } from "./TypingTestContext.jsx";
import { useReportSoloTypingResult } from "../../hooks/useReportSoloTypingResult.js";

export function ResultsPanel() {
  const { engine, nowMs, restart } = useTypingTest();
  const m = useTypingLiveMetrics(engine, nowMs);

  useReportSoloTypingResult(engine, m);

  if (engine.status !== "completed") {
    return null;
  }

  const fmt = (n) =>
    Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "0.0";

  return (
    <div
      className="typing-race-focus-keep mx-auto w-full max-w-md px-4"
      role="region"
      aria-label="Test results"
    >
      <div className="rounded-[var(--tt-radius-lg)] border border-[var(--tt-ink-muted)]/20 bg-[var(--tt-bg-elevated)]/95 px-6 py-10 text-center shadow-[var(--tt-shadow-soft)] backdrop-blur-md">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-[var(--tt-accent)]">
          Session complete
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 text-left">
          <MetricBlurb
            label="wpm"
            tooltipId="tip-wpm"
            tooltip="Gross speed: (correct characters ÷ 5) per minute using elapsed time. Uses the standard “5 characters ≈ one word” rule."
            value={fmt(m.wpm)}
            highlight
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
          className="font-sans mt-10 w-full rounded-[var(--tt-radius-md)] bg-[rgb(124_108_240_/0.22)] px-6 py-3 text-sm font-semibold text-[var(--tt-ink-strong)] shadow-[inset_0_0_0_1px_rgb(124_108_240_/0.4)] transition hover:bg-[rgb(124_108_240_/0.32)]"
          onClick={restart}
        >
          Start again
        </button>
        <p className="mt-5 font-sans text-xs text-[var(--tt-ink-muted)]">
          <kbd className="rounded-[6px] border border-[var(--tt-ink-muted)]/35 bg-[var(--tt-bg)] px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{" "}
          or{" "}
          <kbd className="rounded-[6px] border border-[var(--tt-ink-muted)]/35 bg-[var(--tt-bg)] px-1.5 py-0.5 font-mono text-[10px]">
            Tab
          </kbd>
        </p>
      </div>
    </div>
  );
}

function MetricBlurb({
  label,
  value,
  tooltip,
  tooltipId,
  highlight,
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--tt-ink-muted)]">
          {label}
        </span>
        <button
          type="button"
          className="cursor-help rounded p-0.5 text-[10px] leading-none text-[var(--tt-accent-soft)] hover:bg-[rgb(124_108_240_/0.1)]"
          title={tooltip}
          id={tooltipId}
          aria-label={`Definition: ${label}`}
        >
          ?
        </button>
      </div>
      <div
        className={`mt-1.5 font-mono text-[1.65rem] tabular-nums leading-none tracking-tight sm:text-3xl ${
          highlight ? "text-[var(--tt-ink-strong)]" : "text-[var(--tt-ink)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
