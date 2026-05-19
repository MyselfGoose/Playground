"use client";

import "../../app/games/typing-race/typing-race.css";
import { TypingTestProvider } from "./TypingTestProvider.jsx";
import { TypingTestView } from "./TypingTestView.jsx";
import { DailyChallengeBanner } from "./DailyChallengeBanner.jsx";

export function TypingTestShell() {
  return (
    <TypingTestProvider>
      <DailyChallengeBanner />
      <TypingTestView />
    </TypingTestProvider>
  );
}
