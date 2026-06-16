/** @typedef {'A' | 'B'} TabooTeam */

/** @param {TabooTeam} team */
export function tabooTeamColors(team) {
  return team === "A"
    ? {
        bg: "bg-taboo-team-a-soft",
        border: "border-taboo-team-a/50",
        borderFaint: "border-taboo-team-a/25",
        dot: "bg-taboo-team-a",
        iconBg: "bg-taboo-team-a-soft",
        iconText: "text-taboo-team-a-text",
        gradientFrom: "from-taboo-team-a/10",
        avatarBg: "bg-taboo-team-a",
        highlight: "bg-taboo-team-a-soft",
        label: "Alpha",
        pillBg: "bg-taboo-team-a-soft",
        pillBorder: "border-taboo-team-a/30",
        pillText: "text-taboo-team-a-text",
        text: "text-taboo-team-a-text",
        activeScoreBg: "border border-taboo-team-a/40 bg-taboo-team-a-soft taboo-glow-a",
        inactiveScoreBg: "border border-taboo-border taboo-surface-card",
        youText: "text-taboo-team-a-text",
        timerBar: "from-taboo-team-a to-taboo-team-a-hover",
        selectedTile: "border-2 border-taboo-team-a bg-gradient-to-br from-taboo-gradient-a-from/40 to-taboo-team-a/20 shadow-lg shadow-taboo-team-a/20",
        idleTile: "border border-taboo-border bg-white/[0.02] hover:border-taboo-team-a/25 hover:bg-white/[0.04]",
      }
    : {
        bg: "bg-taboo-team-b-soft",
        border: "border-taboo-team-b/50",
        borderFaint: "border-taboo-team-b/25",
        dot: "bg-taboo-team-b",
        iconBg: "bg-taboo-team-b-soft",
        iconText: "text-taboo-team-b-text",
        gradientFrom: "from-taboo-team-b/10",
        avatarBg: "bg-taboo-team-b",
        highlight: "bg-taboo-team-b-soft",
        label: "Beta",
        pillBg: "bg-taboo-team-b-soft",
        pillBorder: "border-taboo-team-b/30",
        pillText: "text-taboo-team-b-text",
        text: "text-taboo-team-b-text",
        activeScoreBg: "border border-taboo-team-b/40 bg-taboo-team-b-soft taboo-glow-b",
        inactiveScoreBg: "border border-taboo-border taboo-surface-card",
        youText: "text-taboo-team-b-text",
        timerBar: "from-taboo-team-b to-taboo-team-b-hover",
        selectedTile: "border-2 border-taboo-team-b bg-gradient-to-br from-taboo-gradient-b-from/40 to-taboo-team-b/20 shadow-lg shadow-taboo-team-b/20",
        idleTile: "border border-taboo-border bg-white/[0.02] hover:border-taboo-team-b/25 hover:bg-white/[0.04]",
      };
}

/** @deprecated Use tabooTeamColors inside Taboo-themed screens */
/** @param {TabooTeam} team */
export function teamColors(team) {
  return tabooTeamColors(team);
}
