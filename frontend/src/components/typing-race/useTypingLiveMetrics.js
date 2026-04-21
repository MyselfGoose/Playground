import { useMemo } from "react";
import { computeTypingMetrics } from "../../lib/typing-test/metrics.js";

/**
 * @param {import('../../lib/typing-test/typing-engine.js').TypingEngineState} engine
 * @param {number} nowMs
 */
export function useTypingLiveMetrics(engine, nowMs) {
  return useMemo(() => {
    if (engine.status === "idle") {
      return {
        wpm: 0,
        rawWpm: 0,
        accuracy: 100,
        errorCount: 0,
        elapsedSec: 0,
        remainingSec: null,
      };
    }
    const start = engine.startedAtMs ?? nowMs;
    let end = nowMs;
    if (engine.status === "completed" && engine.completedAtMs != null) {
      end = engine.completedAtMs;
    }
    let elapsedSec = Math.max(0, (end - start) / 1000);
    if (engine.mode === "time" && engine.timeLimitSec != null) {
      elapsedSec = Math.min(elapsedSec, engine.timeLimitSec);
    }
    const m = computeTypingMetrics(engine.stats, elapsedSec);
    let remainingSec = null;
    if (engine.mode === "time" && engine.timeLimitSec != null) {
      if (engine.status === "idle") {
        remainingSec = engine.timeLimitSec;
      } else if (engine.status === "running" && engine.startedAtMs != null) {
        const left =
          engine.timeLimitSec - (nowMs - engine.startedAtMs) / 1000;
        remainingSec = Math.max(0, left);
      } else if (engine.status === "completed") {
        remainingSec = 0;
      }
    }
    return { ...m, elapsedSec, remainingSec };
  }, [engine, nowMs]);
}
