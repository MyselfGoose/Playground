"use client";

import { HangmanEntryScreen } from "./screens/HangmanEntryScreen.jsx";
import { HangmanLobbyScreen } from "./screens/HangmanLobbyScreen.jsx";
import { HangmanPlayScreen } from "./screens/HangmanPlayScreen.jsx";

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' }} props
 */
export default function HangmanClient({ view }) {
  if (view === "entry") return <HangmanEntryScreen />;
  if (view === "lobby") return <HangmanLobbyScreen />;
  return <HangmanPlayScreen />;
}
