"use client";

import { useEffect, useRef, useState } from "react";

const PHASE_ANNOUNCEMENTS = {
  starting: "Game starting",
  prompt_reveal: "New prompt revealed",
  writing: "Writing phase — submit your lie",
  voting: "Voting phase — pick the truth",
  revealing: "Revealing answers",
  scoring: "Scores updated",
  between_rounds: "Next round starting soon",
  finished: "Game over — final results",
};

/**
 * @param {{ status?: string }} props
 */
export function FibbagePhaseAnnouncer({ status }) {
  const [announcement, setAnnouncement] = useState("");
  const prevStatus = useRef(status);

  useEffect(() => {
    if (status && status !== prevStatus.current) {
      setAnnouncement(PHASE_ANNOUNCEMENTS[status] ?? "");
      prevStatus.current = status;
    }
  }, [status]);

  return (
    <div className="sr-only" aria-live="assertive" aria-atomic="true" role="status">
      {announcement}
    </div>
  );
}
