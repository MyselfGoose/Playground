/** @typedef {'A' | 'B'} TabooTeam */

export const TABOO_COLORS = {
  canvas: "var(--taboo-canvas)",
  canvasMid: "var(--taboo-canvas-mid)",
  canvasElevated: "var(--taboo-canvas-elevated)",
  text: "var(--taboo-text)",
  textMuted: "var(--taboo-text-muted)",
  textFaint: "var(--taboo-text-faint)",
  accent: "var(--taboo-accent)",
  accentHover: "var(--taboo-accent-hover)",
  teamA: "var(--taboo-team-a)",
  teamAText: "var(--taboo-team-a-text)",
  teamB: "var(--taboo-team-b)",
  teamBText: "var(--taboo-team-b-text)",
  success: "var(--taboo-success)",
  danger: "var(--taboo-danger)",
  dangerText: "var(--taboo-danger-text)",
  warning: "var(--taboo-warning)",
};

/** Raw hex values for contexts that can't resolve CSS vars (e.g. canvas drawing, SVG generation) */
export const TABOO_RAW_COLORS = {
  canvas: "#0f0e0d",
  teamA: "#5b9fd4",
  teamAText: "#9ed0ff",
  teamB: "#ff7d70",
  teamBText: "#ff9a90",
  success: "#4fdcd1",
  danger: "#f87171",
  dangerText: "#fca5a5",
  warning: "#ffd966",
  gradientAFrom: "#2d5a8a",
  gradientATo: "#4a8fd4",
  gradientBFrom: "#c44a3d",
  accent: "#b8a3ff",
};

export const TABOO_DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  deliberate: 0.6,
};

export const TABOO_SPRING = {
  default: { type: "spring", stiffness: 400, damping: 30 },
  snappy: { type: "spring", stiffness: 500, damping: 35 },
  gentle: { type: "spring", stiffness: 300, damping: 25 },
};

export const TABOO_EASE = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.45, 0, 0.55, 1],
};

export const TABOO_SPACING = {
  1: "var(--taboo-space-1)",
  2: "var(--taboo-space-2)",
  3: "var(--taboo-space-3)",
  4: "var(--taboo-space-4)",
  5: "var(--taboo-space-5)",
  6: "var(--taboo-space-6)",
  8: "var(--taboo-space-8)",
  10: "var(--taboo-space-10)",
  12: "var(--taboo-space-12)",
};

export const TABOO_ELEVATION = {
  card: "taboo-surface-card",
  raised: "taboo-surface-raised",
  inset: "taboo-surface-inset",
};
