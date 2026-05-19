"use client";

import { Suspense } from "react";
import { HangmanEntryScreen } from "./screens/HangmanEntryScreen.jsx";
import { HangmanLobbyScreen } from "./screens/HangmanLobbyScreen.jsx";
import { HangmanPlayScreen } from "./screens/HangmanPlayScreen.jsx";

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' }} props
 */
export default function HangmanClient({ view }) {
  if (view === "entry") {
    return (
      <Suspense fallback={<div className="px-4 py-20 text-center text-foreground/60">Loading…</div>}>
        <HangmanEntryScreen />
      </Suspense>
    );
  }
  if (view === "lobby") return <HangmanLobbyScreen />;
  return <HangmanPlayScreen />;
}
