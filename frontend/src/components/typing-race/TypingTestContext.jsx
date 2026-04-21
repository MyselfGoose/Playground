"use client";

import { createContext, useContext } from "react";

/** @typedef {import('../../lib/typing-test/typing-engine.js').TypingEngineState} TypingEngineState */

/**
 * @typedef {{
 *   engine: TypingEngineState;
 *   nowMs: number;
 *   focusMode: boolean;
 *   useSentences: boolean;
 *   testMode: 'time' | 'words';
 *   timeLimitSec: number;
 *   wordTarget: number;
 *   tabArmed: boolean;
 *   isComposing: boolean;
 *   dispatch: (a: import('./typingTestReducer.js').TypingAction) => void;
 *   inputRef: React.RefObject<HTMLTextAreaElement | null>;
 *   restart: () => void;
 *   refreshPassageIfIdle: () => void;
 *   refreshWith: (partial?: Partial<{ testMode: 'time'|'words'; timeLimitSec: number; wordTarget: number; useSentences: boolean }>) => void;
 *   setFocusMode: (v: boolean | ((p: boolean) => boolean)) => void;
 *   setTestMode: (m: 'time' | 'words') => void;
 *   setTimeLimitSec: (n: number) => void;
 *   setWordTarget: (n: number) => void;
 *   setUseSentences: (v: boolean | ((p: boolean) => boolean)) => void;
 *   setTabArmed: (v: boolean) => void;
 *   setIsComposing: (v: boolean) => void;
 * }} TypingTestContextValue
 */

/** @type {React.Context<TypingTestContextValue | null>} */
const TypingTestContext = createContext(null);

export function useTypingTest() {
  const v = useContext(TypingTestContext);
  if (!v) {
    throw new Error("useTypingTest outside TypingTestProvider");
  }
  return v;
}

export { TypingTestContext };
