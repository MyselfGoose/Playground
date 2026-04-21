"use client";

import "../../app/games/typing-race/typing-race.css";
import { TypingTestProvider } from "./TypingTestProvider.jsx";
import { TypingTestView } from "./TypingTestView.jsx";

export function TypingTestShell() {
  return (
    <TypingTestProvider>
      <TypingTestView />
    </TypingTestProvider>
  );
}
