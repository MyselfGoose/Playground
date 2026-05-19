"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api.js";
import { useTypingTest } from "./TypingTestContext.jsx";

/**
 * @param {{ className?: string }} props
 */
export function DailyChallengeBanner({ className = "" }) {
  const { startDailyChallenge } = useTypingTest();
  const [daily, setDaily] = useState(/** @type {{ seed: number; date: string } | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await apiFetch("/api/v1/leaderboard/typing/daily");
        if (!cancelled) {
          setDaily(json?.data ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load daily challenge");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !daily) return null;

  return (
    <div
      className={`typing-race-chrome mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-[var(--tt-radius-md)] border border-[var(--tt-accent-soft)]/30 bg-[rgb(124_108_240_/0.12)] px-4 py-3 ${className}`}
    >
      <div>
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tt-accent)]">
          Daily challenge
        </p>
        <p className="mt-0.5 font-sans text-sm text-[var(--tt-ink-muted)]">
          Same passage for everyone · {daily.date}
        </p>
      </div>
      <button
        type="button"
        className="rounded-[var(--tt-radius-md)] bg-[rgb(124_108_240_/0.25)] px-4 py-2 font-sans text-sm font-semibold text-[var(--tt-ink-strong)] ring-1 ring-[var(--tt-accent-soft)]/40 transition hover:bg-[rgb(124_108_240_/0.35)]"
        data-no-refocus
        onClick={() => startDailyChallenge(daily.seed)}
      >
        Start daily
      </button>
    </div>
  );
}
