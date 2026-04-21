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
    `rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
      active
        ? "bg-[var(--tt-accent)]/25 text-[var(--tt-ink)] ring-1 ring-[var(--tt-accent)]/50"
        : "text-[var(--tt-ink-muted)] hover:bg-[var(--tt-surface)]/80"
    }`;

  return (
    <div className="typing-race-chrome mx-auto grid max-w-4xl gap-4 px-2 sm:px-4">
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
          <span className="mr-1 text-xs uppercase tracking-wide text-[var(--tt-ink-muted)]">
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
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-wide text-[var(--tt-ink-muted)]">
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

      <p className="text-center text-xs text-[var(--tt-ink-muted)]">
        <kbd className="rounded border border-[var(--tt-ink-muted)]/40 px-1.5 py-0.5 font-mono text-[10px]">
          Tab
        </kbd>{" "}
        then{" "}
        <kbd className="rounded border border-[var(--tt-ink-muted)]/40 px-1.5 py-0.5 font-mono text-[10px]">
          Enter
        </kbd>{" "}
        to restart · when idle,{" "}
        <kbd className="rounded border border-[var(--tt-ink-muted)]/40 px-1.5 py-0.5 font-mono text-[10px]">
          Tab
        </kbd>{" "}
        restarts
      </p>
    </div>
  );
}

export const TypingToolbar = memo(TypingToolbarInner);
