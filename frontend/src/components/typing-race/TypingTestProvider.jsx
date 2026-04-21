"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createInitialState } from "../../lib/typing-test/typing-engine.js";
import { generatePassage } from "../../lib/typing-test/text-gen.js";
import { typingTestReducer } from "./typingTestReducer.js";
import { TypingTestContext } from "./TypingTestContext.jsx";

function randomSeed() {
  return (Math.random() * 2 ** 31) >>> 0;
}

function buildInitialEngine({
  testMode,
  timeLimitSec,
  wordTarget,
  useSentences,
}) {
  const seed = randomSeed();
  const passage = generatePassage({
    mode: testMode,
    seed,
    timeLimitSec,
    wordTarget,
    useSentences,
  });
  return createInitialState({
    mode: testMode,
    seed,
    passage,
    timeLimitSec: testMode === "time" ? timeLimitSec : undefined,
    wordTarget: testMode === "words" ? wordTarget : undefined,
  });
}

/** @param {{ children: React.ReactNode }} props */
export function TypingTestProvider({ children }) {
  const [testMode, setTestMode] = useState(
    /** @type {'time' | 'words'} */ ("time"),
  );
  const [timeLimitSec, setTimeLimitSec] = useState(60);
  const [wordTarget, setWordTarget] = useState(25);
  const [useSentences, setUseSentences] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [tabArmed, setTabArmed] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [engine, dispatch] = useReducer(
    typingTestReducer,
    { testMode, timeLimitSec, wordTarget, useSentences },
    (s) =>
      buildInitialEngine({
        testMode: s.testMode,
        timeLimitSec: s.timeLimitSec,
        wordTarget: s.wordTarget,
        useSentences: s.useSentences,
      }),
  );

  const [nowMs, setNowMs] = useState(0);

  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const rafRef = useRef(0);

  const restart = useCallback(() => {
    dispatch({
      type: "RESTART",
      seed: randomSeed(),
      testMode,
      timeLimitSec,
      wordTarget,
      useSentences,
    });
    setTabArmed(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [testMode, timeLimitSec, wordTarget, useSentences]);

  const refreshWith = useCallback((partial = {}) => {
    dispatch({
      type: "RESTART",
      seed: randomSeed(),
      testMode: partial.testMode ?? testMode,
      timeLimitSec: partial.timeLimitSec ?? timeLimitSec,
      wordTarget: partial.wordTarget ?? wordTarget,
      useSentences: partial.useSentences ?? useSentences,
    });
  }, [testMode, timeLimitSec, wordTarget, useSentences]);

  const refreshPassageIfIdle = useCallback(() => {
    refreshWith({});
  }, [refreshWith]);

  useEffect(() => {
    if (engine.status !== "running") {
      return;
    }
    const loop = (t) => {
      setNowMs(t);
      rafRef.current = requestAnimationFrame(loop);
      dispatch({ type: "TICK", now: t });
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine.status]);

  const value = useMemo(
    () => ({
      engine,
      nowMs,
      focusMode,
      useSentences,
      testMode,
      timeLimitSec,
      wordTarget,
      tabArmed,
      isComposing,
      dispatch,
      inputRef,
      restart,
      refreshPassageIfIdle,
      refreshWith,
      setFocusMode,
      setTestMode,
      setTimeLimitSec,
      setWordTarget,
      setUseSentences,
      setTabArmed,
      setIsComposing,
    }),
    [
      engine,
      nowMs,
      focusMode,
      useSentences,
      testMode,
      timeLimitSec,
      wordTarget,
      tabArmed,
      isComposing,
      dispatch,
      restart,
      refreshPassageIfIdle,
      refreshWith,
    ],
  );

  return (
    <TypingTestContext.Provider value={value}>
      {children}
    </TypingTestContext.Provider>
  );
}
