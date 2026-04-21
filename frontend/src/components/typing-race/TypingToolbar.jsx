"use client";

import { memo } from "react";
import {
  TIME_LIMITS_SEC,
  WORD_TARGETS,
} from "../../lib/typing-test/text-gen.js";
import { useTypingTest } from "./TypingTestContext.jsx";

function TypingToolbarInner() {
  const {
    engine,
    testMode,
    setTestMode,
    timeLimitSec,
    setTimeLimitSec,
    wordTarget,
    setWordTarget,
    useSentences,
    setUseSentences,
    focusMode,
    setFocusMode,
    refreshWith,
  } = useTypingTest();

  const busy = engine.status === "running";
  const canSwapSettings = !busy;

  const pill = (active) =>
    `font-sans rounded-[var(--tt-radius-md)] px-3 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${
      active
        ? "bg-[rgb(124_108_240_/0.2)] text-[var(--tt-ink-strong)] shadow-[inset_0_0_0_1px_rgb(124_108_240_/0.35)]"
        : "text-[var(--tt-ink-muted)] hover:bg-[rgb(124_108_240_/0.08)] hover:text-[var(--tt-ink)]"
    }`;

  return (
    <div className="typing-race-chrome mx-auto mt-5 w-full max-w-3xl space-y-5 px-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="sr-only">Test mode</span>
        <button
          type="button"
          disabled={busy}
          className={pill(testMode === "time")}
          onClick={() => {
            setTestMode("time");
            if (canSwapSettings) {
              refreshWith({ testMode: "time" });
            }
          }}
        >
          time
        </button>
        <button
          type="button"
          disabled={busy}
          className={pill(testMode === "words")}
          onClick={() => {
            setTestMode("words");
            if (canSwapSettings) {
              refreshWith({ testMode: "words" });
            }
          }}
        >
          words
        </button>
      </div>

      {testMode === "time" ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tt-ink-faint)]">
            duration
          </span>
          {TIME_LIMITS_SEC.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              className={pill(timeLimitSec === s)}
              onClick={() => {
                setTimeLimitSec(s);
                if (canSwapSettings) {
                  refreshWith({ timeLimitSec: s });
                }
              }}
            >
              {s}s
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tt-ink-faint)]">
            count
          </span>
          {WORD_TARGETS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              className={pill(wordTarget === n)}
              onClick={() => {
                setWordTarget(n);
                if (canSwapSettings) {
                  refreshWith({ wordTarget: n });
                }
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className={pill(useSentences)}
          disabled={busy}
          onClick={() => {
            setUseSentences((prev) => {
              const next = !prev;
              if (canSwapSettings) {
                refreshWith({ useSentences: next });
              }
              return next;
            });
          }}
        >
          sentences
        </button>
        <button
          type="button"
          className={pill(focusMode)}
          onClick={() => setFocusMode((v) => !v)}
        >
          focus
        </button>
      </div>

      <p className="text-center font-sans text-[11px] leading-relaxed text-[var(--tt-ink-faint)]">
        <kbd className="rounded-[6px] border border-[var(--tt-ink-muted)]/35 bg-[var(--tt-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--tt-ink-muted)]">
          Tab
        </kbd>{" "}
        then{" "}
        <kbd className="rounded-[6px] border border-[var(--tt-ink-muted)]/35 bg-[var(--tt-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--tt-ink-muted)]">
          Enter
        </kbd>{" "}
        to restart · idle:{" "}
        <kbd className="rounded-[6px] border border-[var(--tt-ink-muted)]/35 bg-[var(--tt-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--tt-ink-muted)]">
          Tab
        </kbd>{" "}
        alone
      </p>
    </div>
  );
}

export const TypingToolbar = memo(TypingToolbarInner);
