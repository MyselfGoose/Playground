"use client";

import { useEffect, useState } from "react";

/**
 * Screen-reader announcements for Taboo turn and phase changes.
 *
 * @param {{ game?: { status?: string, activeTeam?: string, activeTurn?: { playerName?: string } } | null }} props
 */
export function TabooPhaseAnnouncer({ game }) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!game) {
      setAnnouncement("");
      return;
    }

    const teamLabel = game.activeTeam === "B" ? "Beta" : "Alpha";
    const playerName = game.activeTurn?.playerName || "a player";
    const status = game.status === "in_progress" ? "turn_in_progress" : game.status;

    if (status === "turn_in_progress") {
      setAnnouncement(`Team ${teamLabel}'s turn. ${playerName} is giving clues.`);
      return;
    }
    if (status === "waiting_to_start_turn") {
      setAnnouncement(`Next turn: Team ${teamLabel}, ${playerName}.`);
      return;
    }
    if (status === "between_turns") {
      setAnnouncement(`Between turns. Up next: Team ${teamLabel}, ${playerName}.`);
      return;
    }
    if (status === "between_rounds") {
      setAnnouncement("Round complete. Next round starting soon.");
      return;
    }
    setAnnouncement("");
  }, [game?.status, game?.activeTeam, game?.activeTurn?.playerName]);

  if (!announcement) return null;

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );
}
