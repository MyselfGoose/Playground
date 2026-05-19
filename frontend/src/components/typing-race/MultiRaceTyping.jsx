"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useVisualViewportKeyboard } from "../../lib/hooks/useVisualViewportKeyboard.js";
import { createInitialState, getDisplayIndex } from "../../lib/typing-test/typing-engine.js";
import { computeTypingMetrics } from "../../lib/typing-test/metrics.js";
import { handleRaceTypingKeyDown } from "../../lib/typing-test/typingKeyHandlers.js";
import { useTypingInputCapture } from "../../lib/typing-test/useTypingInputCapture.js";
import { typingTestReducer } from "./typingTestReducer.js";
import { TypingPassage } from "./TypingPassage.jsx";
import { TypingRaceInput } from "./TypingRaceInput.jsx";
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
  const passageAreaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
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
  const lastSentRef = useRef({ cursorDisplay: -1, cursor: -1, errorLen: -1, wpm: -1, sentAt: 0 });
  const pendingRef = useRef(/** @type {null | { cursorDisplay: number; cursor: number; errorLen: number; wpm: number; clientTs: number }} */ (null));
  const flushTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  engineRef.current = engine;

  const captureActive =
    isRacing && (engine.status === "idle" || engine.status === "running");

  const onCapturedKey = useCallback(
    (e) => {
      handleRaceTypingKeyDown({ isComposing, dispatch }, e);
    },
    [isComposing, dispatch],
  );

  const capture = useTypingInputCapture({
    inputRef,
    active: captureActive,
    isComposing,
    onCapturedKey,
  });

  useVisualViewportKeyboard(passageAreaRef, {
    enabled: captureActive,
    refocusInputRef: inputRef,
  });

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
  }, [raceConfig]);

  useEffect(() => {
    if (!isRacing) {
      return undefined;
    }
    const flushPending = () => {
      if (!pendingRef.current) {
        return;
      }
      const next = pendingRef.current;
      pendingRef.current = null;
      lastSentRef.current = {
        cursorDisplay: next.cursorDisplay,
        cursor: next.cursor,
        errorLen: next.errorLen,
        wpm: next.wpm,
        sentAt: Date.now(),
      };
      void sendProgress(next);
    };

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
      const payload = {
        cursorDisplay: getDisplayIndex(eng),
        cursor: eng.cursor,
        errorLen: eng.errorStack.length,
        wpm: Math.round(m.wpm),
        clientTs: Date.now(),
      };
      const prev = lastSentRef.current;
      const unchanged =
        payload.cursorDisplay === prev.cursorDisplay &&
        payload.cursor === prev.cursor &&
        payload.errorLen === prev.errorLen &&
        payload.wpm === prev.wpm;
      if (unchanged) {
        return;
      }
      const sinceLast = Date.now() - prev.sentAt;
      if (sinceLast >= 150) {
        lastSentRef.current = { ...payload, sentAt: Date.now() };
        void sendProgress(payload);
      } else {
        pendingRef.current = payload;
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            flushPending();
          }, Math.max(1, 150 - sinceLast));
        }
      }
    }, 80);
    return () => {
      clearInterval(id);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushPending();
    };
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
          correctChars: eng.stats.correctChars,
          incorrectChars: eng.stats.incorrectChars,
          extraChars: eng.stats.extraChars,
        }),
      );
    }
  }, [engine.status, onDone]);

  const onKeyDown = useCallback(
    (e) => {
      handleRaceTypingKeyDown({ isComposing, dispatch }, e);
    },
    [isComposing, dispatch],
  );

  return (
    <div
      ref={passageAreaRef}
      className={`relative pb-[var(--keyboard-offset,0px)] ${capture.passageAreaClassName}`}
      onPointerDown={capture.onPassagePointerDown}
      role="presentation"
    >
      <TypingRaceInput
        inputRef={inputRef}
        bindInputFocus={capture.bindInputFocus}
        isComposing={isComposing}
        setIsComposing={setIsComposing}
        onKeyDown={onKeyDown}
      />
      {capture.needsResumeHint && (
        <p
          id="typing-race-resume-hint"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 text-center text-xs text-[var(--tt-ink-muted)]"
        >
          Tap here or keep typing to resume
        </p>
      )}
      <TypingPassage
        passage={engine.passage}
        cursor={engine.cursor}
        errorStack={engine.errorStack}
        peerCursors={peerCursors}
        ariaDescribedBy={capture.needsResumeHint ? "typing-race-resume-hint" : undefined}
      />
    </div>
  );
}
