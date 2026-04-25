"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "../lib/api.js";

/**
 * Reports solo typing test results to the server for leaderboard tracking.
 * Fires once per unique completion (keyed by seed + completedAtMs).
 *
 * @param {import('../lib/typing-test/typing-engine.js').TypingEngineState} engine
 * @param {{ wpm: number, rawWpm: number, accuracy: number, errorCount: number }} metrics
 */
export function useReportSoloTypingResult(engine, metrics) {
  const reportedRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    if (engine.status !== "completed") {
      reportedRef.current = null;
      return;
    }
    const key = `${engine.seed}:${engine.completedAtMs}`;
    if (reportedRef.current === key) return;
    reportedRef.current = key;

    const elapsedMs =
      engine.startedAtMs != null && engine.completedAtMs != null
        ? engine.completedAtMs - engine.startedAtMs
        : 0;
    if (elapsedMs <= 0) return;

    const payload = {
      passageLength: engine.passage.length,
      correctChars: engine.stats.correctChars,
      incorrectChars: engine.stats.incorrectChars,
      extraChars: engine.stats.extraChars,
      wpm: metrics.wpm,
      rawWpm: metrics.rawWpm,
      elapsedMs,
    };

    void apiFetch("/api/v1/leaderboard/typing/solo", {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [engine.status, engine.seed, engine.completedAtMs, engine.startedAtMs, engine.passage.length, engine.stats, metrics]);
}
