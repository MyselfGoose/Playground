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
      className="typing-race-root flex min-h-[calc(100vh-4rem)] flex-col font-mono text-[15px] leading-relaxed antialiased sm:text-[16px]"
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <TypingHiddenInput />
      <header className="mx-auto max-w-4xl px-4 pt-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--tt-accent)]">
          Typing test
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--tt-ink)] sm:text-3xl">
          Stay smooth. Stay sharp.
        </h1>
      </header>
      <TypingToolbar />
      <TypingHud />
      <div className="relative flex flex-1 flex-col">
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
