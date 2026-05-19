"use client";

import { useCallback } from "react";
import { handleSoloTypingKeyDown } from "../../lib/typing-test/typingKeyHandlers.js";
import { useTypingTest } from "./TypingTestContext.jsx";
import { TypingRaceInput } from "./TypingRaceInput.jsx";

/**
 * @param {{
 *   bindInputFocus?: () => { onFocus?: () => void; onBlur?: () => void };
 * }} [props]
 */
export function TypingHiddenInput({ bindInputFocus }) {
  const {
    engine,
    dispatch,
    inputRef,
    restart,
    isComposing,
    setIsComposing,
    tabArmed,
    setTabArmed,
  } = useTypingTest();

  const onKeyDown = useCallback(
    (e) => {
      handleSoloTypingKeyDown(
        {
          engine,
          isComposing,
          tabArmed,
          setTabArmed,
          restart,
          dispatch,
        },
        e,
      );
    },
    [engine, isComposing, tabArmed, setTabArmed, restart, dispatch],
  );

  return (
    <TypingRaceInput
      inputRef={inputRef}
      bindInputFocus={bindInputFocus}
      isComposing={isComposing}
      setIsComposing={setIsComposing}
      onKeyDown={onKeyDown}
    />
  );
}
