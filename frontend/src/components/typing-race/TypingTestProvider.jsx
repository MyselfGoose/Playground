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

const PLACEHOLDER_SEED = 1;

function randomSeed() {
  return (Math.random() * 2 ** 31) >>> 0;
}

/**
 * @param {{
 *   testMode: 'time' | 'words';
 *   timeLimitSec: number;
 *   wordTarget: number;
 *   useSentences: boolean;
 *   seed?: number;
 * }} opts
 */
function buildEngineFromSettings({
  testMode,
  timeLimitSec,
  wordTarget,
  useSentences,
  seed = PLACEHOLDER_SEED,
}) {
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

/** SSR/hydration-safe deterministic initial state. */
function buildPlaceholderEngine(settings) {
  return buildEngineFromSettings({ ...settings, seed: PLACEHOLDER_SEED });
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
  const [passageReady, setPassageReady] = useState(false);

  const settings = useMemo(
    () => ({ testMode, timeLimitSec, wordTarget, useSentences }),
    [testMode, timeLimitSec, wordTarget, useSentences],
  );

  const [engine, dispatch] = useReducer(
    typingTestReducer,
    settings,
    buildPlaceholderEngine,
  );

  const [nowMs, setNowMs] = useState(0);

  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const rafRef = useRef(0);
  const clientInitRef = useRef(false);

  useEffect(() => {
    if (clientInitRef.current) {
      return;
    }
    clientInitRef.current = true;
    dispatch({
      type: "RESTART",
      seed: randomSeed(),
      testMode,
      timeLimitSec,
      wordTarget,
      useSentences,
    });
    setPassageReady(true);
    // Client-only random passage after hydration-safe placeholder.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once on mount
  }, []);

  const restart = useCallback(() => {
    dispatch({
      type: "RESTART",
      seed: randomSeed(),
      ...settings,
    });
    setTabArmed(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [settings]);

  const refreshWith = useCallback(
    (partial = {}) => {
      dispatch({
        type: "RESTART",
        seed: randomSeed(),
        testMode: partial.testMode ?? testMode,
        timeLimitSec: partial.timeLimitSec ?? timeLimitSec,
        wordTarget: partial.wordTarget ?? wordTarget,
        useSentences: partial.useSentences ?? useSentences,
      });
    },
    [testMode, timeLimitSec, wordTarget, useSentences],
  );

  const refreshPassageIfIdle = useCallback(() => {
    refreshWith({});
  }, [refreshWith]);

  const startDailyChallenge = useCallback(
    (seed) => {
      dispatch({
        type: "RESTART",
        seed: (Number(seed) >>> 0) || 1,
        ...settings,
      });
      setPassageReady(true);
      setTabArmed(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [settings],
  );

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
      passageReady,
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
      startDailyChallenge,
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
      passageReady,
      focusMode,
      useSentences,
      testMode,
      timeLimitSec,
      wordTarget,
      tabArmed,
      isComposing,
      restart,
      refreshPassageIfIdle,
      refreshWith,
      startDailyChallenge,
    ],
  );

  return (
    <TypingTestContext.Provider value={value}>
      {children}
    </TypingTestContext.Provider>
  );
}
