"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Flash correct/wrong feedback when guess state changes after a local guess.
 * @param {{ wrongCount?: number; guessed?: string[]; wrong?: string[]; enabled?: boolean }} props
 */
export function useHangmanLetterFeedback({ wrongCount = 0, guessed = [], wrong = [], enabled = true }) {
  const [variant, setVariant] = useState(/** @type {null | 'correct' | 'taboo'} */ (null));
  const prevWrongRef = useRef(wrongCount);
  const prevGuessedLenRef = useRef(guessed.length);
  const prevWrongLenRef = useRef(wrong.length);
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const wrongIncreased = wrongCount > prevWrongRef.current;
    const guessedIncreased = guessed.length > prevGuessedLenRef.current;
    const wrongLettersIncreased = wrong.length > prevWrongLenRef.current;

    prevWrongRef.current = wrongCount;
    prevGuessedLenRef.current = guessed.length;
    prevWrongLenRef.current = wrong.length;

    let next = null;
    if (wrongIncreased || wrongLettersIncreased) next = "taboo";
    else if (guessedIncreased) next = "correct";
    if (!next) return;

    setVariant(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVariant(null), 650);
  }, [enabled, wrongCount, guessed.length, wrong.length, guessed, wrong]);

  return variant;
}
