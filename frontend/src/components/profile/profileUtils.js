/** @param {string | Date | null | undefined} ts */
export function prettyDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** @param {string | Date | null | undefined} ts */
export function prettyDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/** @param {string} game */
export function gameLabel(game) {
  const labels = {
    "typing-race": "Typing Race",
    npat: "NPAT",
    taboo: "Taboo",
    cah: "Cards Against Humanity",
    hangman: "Hangman",
  };
  return labels[game] ?? game;
}
