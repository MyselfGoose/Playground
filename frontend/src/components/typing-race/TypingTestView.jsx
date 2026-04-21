"use client";

import { useEffect } from "react";
import { useTypingTest } from "./TypingTestContext.jsx";
import { TypingHiddenInput } from "./TypingHiddenInput.jsx";
import { TypingHud } from "./TypingHud.jsx";
import { TypingPassage } from "./TypingPassage.jsx";
import { ResultsPanel } from "./ResultsPanel.jsx";
import { TypingToolbar } from "./TypingToolbar.jsx";

export function TypingTestView() {
  const { engine, focusMode, inputRef } = useTypingTest();

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef, engine.passage, engine.seed]);

  return (
    <div
      className="typing-race-root flex min-h-[calc(100vh-4rem)] flex-col antialiased sm:text-[16px]"
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <TypingHiddenInput />
      <header className="typing-race-chrome mx-auto max-w-2xl px-4 pt-8 text-center">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--tt-accent-soft)]">
          Typing test
        </p>
        <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-[var(--tt-ink-strong)] sm:text-3xl">
          Stay smooth. Stay sharp.
        </h1>
      </header>
      <TypingToolbar />
      <TypingHud />
      <div className="relative flex flex-1 flex-col justify-center">
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
