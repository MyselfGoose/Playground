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
import { TypingViewport } from "./TypingViewport.jsx";
import { useViewportLineConfig } from "../../lib/typing-test/useViewportLineConfig.js";
import { useTypingRace } from "../../lib/typing-race/TypingRaceSocketContext.jsx";

/**
 * @param {{
 *   raceConfig: { passage: string; seed: number };
 *   isRacing: boolean;
 *   spectate?: boolean;
 *   frozenEngine?: { passage: string; cursor: number; errorStack: string } | null;
 *   onDone: (stats: object, engineSnap?: { passage: string; cursor: number; errorStack: string }) => void | Promise<void>;
 *   peerCursors?: Array<{ userId: string; displayName: string; color?: string; cursorDisplay?: number; finishedAtMs?: number | null }>;
 * }} props
 */
export function MultiRaceTyping({
  raceConfig,
  isRacing,
  spectate = false,
  frozenEngine = null,
  onDone,
  peerCursors,
}) {
  const { sendProgress } = useTypingRace();
  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const passageAreaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const passageContainerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const caretAnchorRef = useRef(/** @type {HTMLElement | null} */ (null));
  const caretLayoutRef = useRef(
    /** @type {{ top: number; height: number; lineHeightPx: number } | null} */ (null),
  );
  const lineConfig = useViewportLineConfig();
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
  const pendingRef = useRef(
    /** @type {null | { cursorDisplay: number; cursor: number; errorLen: number; wpm: number; clientTs: number }} */ (
      null
    ),
  );
  const flushTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  engineRef.current = engine;

  const flushPendingProgress = useCallback(async () => {
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
    await sendProgress(next);
  }, [sendProgress]);

  const displayPassage = spectate && frozenEngine ? frozenEngine.passage : engine.passage;
  const displayCursor = spectate && frozenEngine ? frozenEngine.cursor : engine.cursor;
  const displayErrors = spectate && frozenEngine ? frozenEngine.errorStack : engine.errorStack;

  const captureActive =
    !spectate && isRacing && (engine.status === "idle" || engine.status === "running");

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
    scrollMode: "padding-only",
  });

  useEffect(() => {
    if (spectate || !raceConfig?.passage) {
      return;
    }
    doneRef.current = false;
    dispatch({
      type: "LOAD_SERVER_PASSAGE",
      passage: raceConfig.passage,
      seed: raceConfig.seed,
    });
  }, [raceConfig, spectate]);

  useEffect(() => {
    if (!isRacing || spectate) {
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
  }, [isRacing, spectate, sendProgress]);

  useEffect(() => {
    if (spectate || engine.status !== "completed" || doneRef.current) {
      return;
    }
    doneRef.current = true;
    const eng = engineRef.current;
    const elapsedSec =
      eng.startedAtMs != null
        ? Math.max(0.001, (performance.now() - eng.startedAtMs) / 1000)
        : 0.001;
    const m = computeTypingMetrics(eng.stats, elapsedSec);
    void (async () => {
      await flushPendingProgress();
      const engNow = engineRef.current;
      const finalSnap = {
        passage: engNow.passage,
        cursor: engNow.cursor,
        errorStack: engNow.errorStack,
      };
      await sendProgress({
        cursorDisplay: getDisplayIndex(engNow),
        cursor: engNow.cursor,
        errorLen: engNow.errorStack.length,
        wpm: Math.round(m.wpm),
        clientTs: Date.now(),
      });
      await onDone(
        {
          wpm: m.wpm,
          rawWpm: m.rawWpm,
          accuracy: m.accuracy,
          errorCount: m.errorCount,
          elapsedSec,
          correctChars: eng.stats.correctChars,
          incorrectChars: eng.stats.incorrectChars,
          extraChars: eng.stats.extraChars,
        },
        finalSnap,
      );
    })();
  }, [engine.status, spectate, onDone, flushPendingProgress, sendProgress]);

  const onKeyDown = useCallback(
    (e) => {
      handleRaceTypingKeyDown({ isComposing, dispatch }, e);
    },
    [isComposing, dispatch],
  );

  return (
    <div
      ref={passageAreaRef}
      className={`relative pb-[var(--keyboard-offset,0px)] ${spectate ? "" : capture.passageAreaClassName}`}
      onPointerDown={spectate ? undefined : capture.onPassagePointerDown}
      role="presentation"
    >
      {!spectate && (
        <TypingRaceInput
          inputRef={inputRef}
          bindInputFocus={capture.bindInputFocus}
          isComposing={isComposing}
          setIsComposing={setIsComposing}
          onKeyDown={onKeyDown}
        />
      )}
      {!spectate && capture.needsResumeHint && (
        <p
          id="typing-race-resume-hint"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 text-center text-xs text-[var(--tt-ink-muted)]"
        >
          Tap here or keep typing to resume
        </p>
      )}
      <p className="tt-language-label">english</p>
      <TypingViewport
        cursor={displayCursor}
        active={isRacing}
        caretAnchorRef={caretAnchorRef}
        passageContainerRef={passageContainerRef}
        caretLayoutRef={caretLayoutRef}
        visibleLines={lineConfig.visibleLines}
        focusLineIndex={lineConfig.focusLineIndex}
      >
        <TypingPassage
          passage={displayPassage}
          cursor={displayCursor}
          errorStack={displayErrors}
          peerCursors={peerCursors}
          passageContainerRef={passageContainerRef}
          caretAnchorRef={caretAnchorRef}
          caretLayoutRef={caretLayoutRef}
          compact
          ariaDescribedBy={
            !spectate && capture.needsResumeHint ? "typing-race-resume-hint" : undefined
          }
        />
      </TypingViewport>
      {spectate && (
        <p className="tt-restart-hint mt-3 text-center text-xs text-[var(--tt-ink-faint)]">
          Spectating — waiting for other players to finish
        </p>
      )}
    </div>
  );
}
