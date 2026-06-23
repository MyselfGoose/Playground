"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useVisualViewportKeyboard } from "../../lib/hooks/useVisualViewportKeyboard.js";
import { handleSoloTypingKeyDown } from "../../lib/typing-test/typingKeyHandlers.js";
import { useTypingInputCapture } from "../../lib/typing-test/useTypingInputCapture.js";
import { useViewportLineConfig } from "../../lib/typing-test/useViewportLineConfig.js";
import { useTypingTest } from "./TypingTestContext.jsx";
import { TypingHiddenInput } from "./TypingHiddenInput.jsx";
import { TypingHud } from "./TypingHud.jsx";
import { useTypingPageLock } from "../../lib/typing-test/useTypingPageLock.js";
import { TypingPassage } from "./TypingPassage.jsx";
import { TypingViewport } from "./TypingViewport.jsx";
import { ResultsPanel } from "./ResultsPanel.jsx";
import { TypingToolbar } from "./TypingToolbar.jsx";

export function TypingTestView() {
  const {
    engine,
    passageReady,
    focusMode,
    inputRef,
    dispatch,
    isComposing,
    tabArmed,
    setTabArmed,
    restart,
  } = useTypingTest();
  const lineConfig = useViewportLineConfig();
  const passageAreaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const passageContainerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const caretAnchorRef = useRef(/** @type {HTMLElement | null} */ (null));
  const caretLayoutRef = useRef(
    /** @type {{ top: number; height: number; lineHeightPx: number } | null} */ (null),
  );
  const soloActive =
    passageReady && (engine.status === "idle" || engine.status === "running");

  useTypingPageLock(soloActive);

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
    scrollMode: "padding-only",
  });

  useEffect(() => {
    if (soloActive) {
      capture.focusInput();
    }
  }, [engine.passage, engine.seed, soloActive, capture.focusInput]);

  return (
    <div
      className={`typing-race-root flex min-h-play-area flex-col antialiased pb-[var(--keyboard-offset,0px)] sm:text-[16px] ${soloActive ? "typing-race-root--active" : ""}`}
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <TypingHiddenInput bindInputFocus={capture.bindInputFocus} />
      <header className="typing-race-chrome mx-auto max-w-2xl px-4 pt-6 text-center sm:pt-8">
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
        className={`tt-typing-stage relative ${capture.passageAreaClassName}`}
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
        <p className="tt-language-label">english</p>
        {engine.status === "completed" ? (
          <div className="mx-auto w-full max-w-[min(76ch,100%-1.5rem)]">
            <ResultsPanel />
          </div>
        ) : !passageReady ? (
          <div
            className="tt-passage-skeleton rounded-[var(--tt-radius-md)] bg-[var(--tt-bg-elevated)]/40"
            aria-hidden
            style={{
              // @ts-expect-error CSS variables
              "--tt-visible-lines": lineConfig.visibleLines,
            }}
          />
        ) : (
          <TypingViewport
            cursor={engine.cursor}
            active={soloActive}
            caretAnchorRef={caretAnchorRef}
            passageContainerRef={passageContainerRef}
            caretLayoutRef={caretLayoutRef}
            visibleLines={lineConfig.visibleLines}
            focusLineIndex={lineConfig.focusLineIndex}
          >
            <TypingPassage
              passage={engine.passage}
              cursor={engine.cursor}
              errorStack={engine.errorStack}
              passageContainerRef={passageContainerRef}
              caretAnchorRef={caretAnchorRef}
              caretLayoutRef={caretLayoutRef}
              compact
              ariaDescribedBy={capture.needsResumeHint ? "typing-resume-hint" : undefined}
            />
          </TypingViewport>
        )}
        <p className="tt-restart-hint">
          <kbd>tab</kbd> + <kbd>enter</kbd> — restart · <kbd>esc</kbd> — command line
        </p>
      </div>
    </div>
  );
}
