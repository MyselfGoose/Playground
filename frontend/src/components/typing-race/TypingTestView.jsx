"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useVisualViewportKeyboard } from "../../lib/hooks/useVisualViewportKeyboard.js";
import { handleSoloTypingKeyDown } from "../../lib/typing-test/typingKeyHandlers.js";
import { useTypingInputCapture } from "../../lib/typing-test/useTypingInputCapture.js";
import { useTypingTest } from "./TypingTestContext.jsx";
import { TypingHiddenInput } from "./TypingHiddenInput.jsx";
import { TypingHud } from "./TypingHud.jsx";
import { TypingPassage } from "./TypingPassage.jsx";
import { ResultsPanel } from "./ResultsPanel.jsx";
import { TypingToolbar } from "./TypingToolbar.jsx";

export function TypingTestView() {
  const {
    engine,
    focusMode,
    inputRef,
    dispatch,
    isComposing,
    tabArmed,
    setTabArmed,
    restart,
  } = useTypingTest();
  const passageAreaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const soloActive = engine.status === "idle" || engine.status === "running";

  const onCapturedKey = useCallback(
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

  const capture = useTypingInputCapture({
    inputRef,
    active: soloActive,
    isComposing,
    onCapturedKey,
  });

  useVisualViewportKeyboard(passageAreaRef, {
    enabled: soloActive,
    refocusInputRef: inputRef,
  });

  useEffect(() => {
    if (soloActive) {
      capture.focusInput();
    }
  }, [engine.passage, engine.seed, soloActive, capture.focusInput]);

  return (
    <div
      className="typing-race-root flex min-h-[calc(100dvh-4rem)] flex-col antialiased pb-[var(--keyboard-offset,0px)] sm:text-[16px]"
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <TypingHiddenInput bindInputFocus={capture.bindInputFocus} />
      <header className="typing-race-chrome mx-auto max-w-2xl px-4 pt-8 text-center">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--tt-accent-soft)]">
          Typing test ·{" "}
          <Link
            href="/games/typing-race/multi"
            className="text-[var(--tt-accent)] underline-offset-2 hover:underline"
          >
            Multiplayer
          </Link>
        </p>
        <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-[var(--tt-ink-strong)] sm:text-3xl">
          Stay smooth. Stay sharp.
        </h1>
      </header>
      <TypingToolbar onMinimalUiToggle={capture.focusInput} />
      <TypingHud />
      <div
        ref={passageAreaRef}
        className={`relative flex flex-1 flex-col justify-center ${capture.passageAreaClassName}`}
        onPointerDown={capture.onPassagePointerDown}
        role="presentation"
      >
        {capture.needsResumeHint && (
          <p
            id="typing-resume-hint"
            className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center text-xs text-[var(--tt-ink-muted)]"
          >
            Click here or keep typing to resume
          </p>
        )}
        {engine.status === "completed" ? (
          <ResultsPanel />
        ) : (
          <TypingPassage
            passage={engine.passage}
            cursor={engine.cursor}
            errorStack={engine.errorStack}
            ariaDescribedBy={capture.needsResumeHint ? "typing-resume-hint" : undefined}
          />
        )}
      </div>
    </div>
  );
}