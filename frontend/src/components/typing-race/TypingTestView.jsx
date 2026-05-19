"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useVisualViewportKeyboard } from "../../lib/hooks/useVisualViewportKeyboard.js";
import { useTypingTest } from "./TypingTestContext.jsx";
import { TypingHiddenInput } from "./TypingHiddenInput.jsx";
import { TypingHud } from "./TypingHud.jsx";
import { TypingPassage } from "./TypingPassage.jsx";
import { ResultsPanel } from "./ResultsPanel.jsx";
import { TypingToolbar } from "./TypingToolbar.jsx";

export function TypingTestView() {
  const { engine, focusMode, inputRef } = useTypingTest();
  const passageAreaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  useVisualViewportKeyboard(passageAreaRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef, engine.passage, engine.seed]);

  return (
    <div
      className="typing-race-root flex min-h-[calc(100dvh-4rem)] flex-col antialiased pb-[var(--keyboard-offset,0px)] sm:text-[16px]"
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <TypingHiddenInput />
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
      <TypingToolbar />
      <TypingHud />
      <div ref={passageAreaRef} className="relative flex flex-1 flex-col justify-center">
        {engine.status === "completed" ? (
          <ResultsPanel />
        ) : (
          <TypingPassage
            passage={engine.passage}
            cursor={engine.cursor}
            errorStack={engine.errorStack}
          />
        )}
      </div>
    </div>
  );
}
