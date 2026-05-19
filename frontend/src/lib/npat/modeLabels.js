/**
 * @param {string | undefined | null} mode
 */
export function formatNpatMode(mode) {
  if (mode === "team") return "Teams";
  return "Free-for-all";
}

/**
 * @param {string | undefined | null} mode
 */
export function isNpatTeamMode(mode) {
  return mode === "team";
}

/**
 * @param {string | undefined | null} mode
 */
export function isNpatFreeForAllMode(mode) {
  return mode === "free-for-all" || mode === "solo" || !mode;
}
