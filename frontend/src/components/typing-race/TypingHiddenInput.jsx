"use client";

import { useTypingTest } from "./TypingTestContext.jsx";

export function TypingHiddenInput() {
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

  return (
    <textarea
      ref={inputRef}
      aria-label="Typing input"
      className="typing-hidden-input"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
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
        if (e.key === "Tab") {
          e.preventDefault();
          if (engine.status === "completed" || engine.status === "idle") {
            restart();
            return;
          }
          setTabArmed(true);
          return;
        }
        if (e.key === "Enter") {
          if (tabArmed) {
            e.preventDefault();
            restart();
            setTabArmed(false);
            return;
          }
          if (engine.status === "completed") {
            e.preventDefault();
            restart();
          }
        }
        if (engine.status === "completed") {
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
        if (e.key !== "Backspace") {
          setTabArmed(false);
        }
      }}
    />
  );
}
