"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, getDisplayIndex } from "../../lib/typing-test/typing-engine.js";
import { computeTypingMetrics } from "../../lib/typing-test/metrics.js";
import { typingTestReducer } from "./typingTestReducer.js";
import { TypingPassage } from "./TypingPassage.jsx";
import { useTypingRace } from "../../lib/typing-race/TypingRaceSocketContext.jsx";

/**
 * @param {{
 *   raceConfig: { passage: string; seed: number };
 *   isRacing: boolean;
 *   onDone: (stats?: { wpm: number; rawWpm: number; accuracy: number; errorCount: number; elapsedSec: number }) => void | Promise<void>;
 *   peerCursors?: Array<{ userId: string; displayName: string; color?: string; cursorDisplay?: number; finishedAtMs?: number | null }>;
 * }} props
 */
export function MultiRaceTyping({ raceConfig, isRacing, onDone, peerCursors }) {
  const { sendProgress } = useTypingRace();
  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const engineRef = useRef(
    createInitialState({
      mode: "words",
      seed: 0,
      passage: " ",
      wordTarget: 1,
    }),
  );
  const doneRef = useRef(false);
  const [engine, dispatch] = useReducer(typingTestReducer, engineRef.current);
  const [isComposing, setIsComposing] = useState(false);

  engineRef.current = engine;

  useEffect(() => {
    if (!raceConfig?.passage) {
      return;
    }
    doneRef.current = false;
    dispatch({
      type: "LOAD_SERVER_PASSAGE",
      passage: raceConfig.passage,
      seed: raceConfig.seed,
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [raceConfig]);

  useEffect(() => {
    if (!isRacing) {
      return undefined;
    }
    const id = setInterval(() => {
      const eng = engineRef.current;
      if (eng.status !== "running" && eng.status !== "idle") {
        return;
      }
      const elapsedSec =
        eng.startedAtMs != null
          ? Math.max(0.001, (performance.now() - eng.startedAtMs) / 1000)
          : 0.001;
      const m = computeTypingMetrics(eng.stats, elapsedSec);
      void sendProgress({
        cursorDisplay: getDisplayIndex(eng),
        cursor: eng.cursor,
        errorLen: eng.errorStack.length,
        wpm: m.wpm,
        clientTs: Date.now(),
      });
    }, 80);
    return () => clearInterval(id);
  }, [isRacing, sendProgress]);

  useEffect(() => {
    if (engine.status === "completed" && !doneRef.current) {
      doneRef.current = true;
      const eng = engineRef.current;
      const elapsedSec =
        eng.startedAtMs != null
          ? Math.max(0.001, (performance.now() - eng.startedAtMs) / 1000)
          : 0.001;
      const m = computeTypingMetrics(eng.stats, elapsedSec);
      void Promise.resolve(
        onDone({
          wpm: m.wpm,
          rawWpm: m.rawWpm,
          accuracy: m.accuracy,
          errorCount: m.errorCount,
          elapsedSec,
        }),
      );
    }
  }, [engine.status, onDone]);

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        aria-label="Typing input"
        className="typing-hidden-input"
        autoComplete="off"
        spellCheck={false}
        rows={1}
        onInput={(e) => {
          e.currentTarget.value = "";
        }}
        onPaste={(e) => e.preventDefault()}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(e) => {
          if (isComposing) {
            return;
          }
          dispatch({
            type: "KEY",
            event: {
              key: e.key,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              altKey: e.altKey,
            },
            ts: e.timeStamp || performance.now(),
          });
        }}
      />
      <TypingPassage
        passage={engine.passage}
        cursor={engine.cursor}
        errorStack={engine.errorStack}
        peerCursors={peerCursors}
      />
    </div>
  );
}
