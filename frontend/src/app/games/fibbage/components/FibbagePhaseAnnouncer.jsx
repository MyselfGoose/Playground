"use client";

const PHASE_LABELS = {
  starting: "Get ready…",
  prompt_reveal: "New prompt incoming",
  writing: "Write your lie",
  voting: "Pick the truth",
  revealing: "Revealing votes",
  scoring: "Round scores",
  between_rounds: "Next round coming up",
};

/**
 * @param {{ status?: string }} props
 */
export function FibbagePhaseAnnouncer({ status }) {
  const label = status ? PHASE_LABELS[status] ?? "Fibbage" : "Fibbage";
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {label}
    </p>
  );
}
