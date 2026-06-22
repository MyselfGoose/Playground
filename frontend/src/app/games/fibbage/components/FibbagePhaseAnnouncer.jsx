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
 * @param {{ status?: string, topHighlight?: { title?: string, body?: string } | null }} props
 */
export function FibbagePhaseAnnouncer({ status, topHighlight }) {
  let label = status ? (PHASE_LABELS[status] ?? "Fibbage") : "Fibbage";
  if (status === "scoring" && topHighlight?.title && topHighlight?.body) {
    label = `${topHighlight.title}: ${topHighlight.body}`;
  }
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {label}
    </p>
  );
}
