"use client";

import { useTypingPageLock } from "../../lib/typing-test/useTypingPageLock.js";
import { MultiRaceTyping } from "./MultiRaceTyping.jsx";

/**
 * Multiplayer typing surface: viewport + optional spectate sidebar layout.
 *
 * @param {{
 *   raceConfig: { passage: string; seed: number };
 *   isRacing: boolean;
 *   spectate?: boolean;
 *   frozenEngine?: { passage: string; cursor: number; errorStack: string } | null;
 *   onDone: (stats: object, engineSnap?: { passage: string; cursor: number; errorStack: string }) => void | Promise<void>;
 *   peerCursors?: Array<{ userId: string; displayName: string; color?: string; cursorDisplay?: number; finishedAtMs?: number | null }>;
 *   sidebar?: import('react').ReactNode;
 * }} props
 */
export function RaceTypingStage({
  raceConfig,
  isRacing,
  spectate = false,
  frozenEngine = null,
  onDone,
  peerCursors,
  sidebar = null,
}) {
  useTypingPageLock(isRacing);

  return (
    <div
      className={`tt-typing-stage mt-4 ${spectate ? "tt-typing-stage-grid tt-typing-stage-grid--spectate" : ""}`}
      data-spectate={spectate ? "true" : "false"}
    >
      <div className="min-w-0">
        <MultiRaceTyping
          raceConfig={raceConfig}
          isRacing={isRacing}
          spectate={spectate}
          frozenEngine={frozenEngine}
          onDone={onDone}
          peerCursors={peerCursors}
        />
      </div>
      {spectate && sidebar ? (
        <aside className="tt-spectate-sidebar space-y-4" aria-label="Your results">
          {sidebar}
        </aside>
      ) : null}
    </div>
  );
}
